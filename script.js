// 로또 번호 생성기 애플리케이션

// 애플리케이션 상태를 관리하는 IIFE(즉시 실행 함수 표현식)
(function() {
    // 역대 당첨번호를 저장할 배열
    const historicalWinningNumbers = [];
    
    // 현재 생성된 조합을 저장할 배열
    let currentGeneratedCombinations = [];
    
    // 마지막으로 생성한 조합 개수
    let lastNumberOfCombinationsToGenerate = 0;
    
    // 각 번호(1-45)의 출현 빈도를 저장할 객체
    let numberFrequencies = {};
    
    // 초기화 함수 - 페이지 로드 시 실행
    function init() {
        createExcludeNumbersGrid();
        createCombinationCountOptions();
        setupEventListeners();
    }
    
    // 이벤트 리스너 설정
    function setupEventListeners() {
        // CSV 파일 선택 이벤트
        document.getElementById('csvFileInput').addEventListener('change', handleFileSelect);
        
        // 번호 생성 버튼 클릭 이벤트
        document.getElementById('generate-button').addEventListener('click', generateLottoNumbers);
        
        // AI 번호 생성 버튼 클릭 이벤트
        document.getElementById('ai-generate-button').addEventListener('click', generateAILottoNumbers);
        
        // 1. 특정 회차 비교 관련 요소 가져오기
        const specificRoundInput = document.getElementById('specificRoundInput');
        const compareSpecificRoundButton = document.getElementById('compareSpecificRoundButton');
        const specificRoundResultArea = document.getElementById('specificRoundResultArea');
        
        // 2. 특정 회차 비교 버튼 클릭 이벤트 처리
        compareSpecificRoundButton.addEventListener('click', function() {
            // a. 결과 영역 초기화
            specificRoundResultArea.innerHTML = '';
            
            // b. 생성된 조합이 있는지 확인
            if (!currentGeneratedCombinations || currentGeneratedCombinations.length === 0) {
                specificRoundResultArea.innerHTML = '<p style="color: red;">먼저 \'번호 생성\' 버튼을 눌러 조합을 생성해주세요.</p>';
                return;
            }
            
            // c. 사용자가 입력한 회차 번호 가져오기
            const targetRound = parseInt(specificRoundInput.value);
            if (isNaN(targetRound) || targetRound <= 0) {
                specificRoundResultArea.innerHTML = '<p style="color: red;">유효한 회차 번호를 입력해주세요.</p>';
                return;
            }
            
            // d. 역대 당첨번호 데이터가 있는지 확인
            if (historicalWinningNumbers.length === 0) {
                specificRoundResultArea.innerHTML = '<p style="color: red;">역대 당첨번호 CSV 파일을 먼저 로드해주세요.</p>';
                return;
            }
            
            // e. 해당 회차의 당첨 정보 찾기
            const historicalEntry = historicalWinningNumbers.find(entry => entry.round === targetRound);
            
            // f. 해당 회차 정보가 없는 경우
            if (!historicalEntry) {
                specificRoundResultArea.innerHTML = `<p style="color: red;">${targetRound}회차 당첨 정보를 찾을 수 없습니다.</p>`;
                return;
            }
            
            // g. 당첨 결과 분석하기
            // i. 당첨 통계 초기화
            const currentRoundRankCounts = {
                "1등": 0,
                "2등": 0,
                "3등": 0,
                "4등": 0,
                "5등": 0
            };
            
            // ii. 총 당첨 개수 초기화
            let totalWinsThisRound = 0;
            
            // iii. 각 조합에 대해 당첨 여부 확인
            currentGeneratedCombinations.forEach(combo => {
                const comparisonResult = compareNumbers(combo, historicalEntry);
                const rank = getPrizeRank(comparisonResult.mainMatchCount, comparisonResult.bonusInGenerated);
                
                if (rank !== "낙첨") {
                    currentRoundRankCounts[rank]++;
                    totalWinsThisRound++;
                }
            });
            
            // h. 적중률 계산
            const comboCount = currentGeneratedCombinations.length;
            const hitRateThisRound = (comboCount > 0) ? (totalWinsThisRound / comboCount) * 100 : 0;
            
            // i. 결과 표시
            // 제목 추가
            const resultTitle = document.createElement('h4');
            resultTitle.textContent = `${targetRound}회차 비교 결과`;
            specificRoundResultArea.appendChild(resultTitle);
            
            // 당첨번호 정보 표시
            const winningNumbersInfo = document.createElement('p');
            winningNumbersInfo.innerHTML = `<strong>당첨번호:</strong> ${historicalEntry.numbers.join(', ')} <span style="color: #FF6600;">(보너스: ${historicalEntry.bonus})</span>`;
            specificRoundResultArea.appendChild(winningNumbersInfo);
            
            // 당첨 결과 표시
            if (totalWinsThisRound === 0) {
                const noWinMsg = document.createElement('p');
                noWinMsg.textContent = '당첨 없음';
                specificRoundResultArea.appendChild(noWinMsg);
            } else {
                // 총 당첨 정보
                const totalWinsInfo = document.createElement('p');
                totalWinsInfo.innerHTML = `<strong>총 당첨:</strong> ${totalWinsThisRound}개 (적중률: ${hitRateThisRound.toFixed(2)}%)`;
                specificRoundResultArea.appendChild(totalWinsInfo);
                
                // 등수별 당첨 정보
                const rankDetails = document.createElement('ul');
                for (const [rank, count] of Object.entries(currentRoundRankCounts)) {
                    if (count > 0) {
                        const rankItem = document.createElement('li');
                        rankItem.innerHTML = `<strong>${rank}:</strong> ${count}개`;
                        
                        // 1등과 2등은 특별히 강조
                        if (rank === "1등") {
                            rankItem.style.color = '#FF0000';
                            rankItem.style.fontWeight = 'bold';
                        } else if (rank === "2등") {
                            rankItem.style.color = '#FF6600';
                            rankItem.style.fontWeight = 'bold';
                        }
                        
                        rankDetails.appendChild(rankItem);
                    }
                }
                specificRoundResultArea.appendChild(rankDetails);
            }
        });
    }
    
    // CSV 파일 선택 처리 함수
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 파일 로드 상태 메시지 초기화
        const fileLoadStatus = document.getElementById('fileLoadStatus');
        fileLoadStatus.textContent = '파일 로딩 중...';
        
        // FileReader를 사용하여 파일 읽기
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const csvText = e.target.result;
            // 배열 내용 초기화 후 새 데이터 추가
            historicalWinningNumbers.length = 0;
            const parsedData = parseCSV(csvText);
            historicalWinningNumbers.push(...parsedData);
            
            if (historicalWinningNumbers.length > 0) {
                fileLoadStatus.textContent = `총 ${historicalWinningNumbers.length}개의 당첨번호 데이터가 로드되었습니다.`;
                fileLoadStatus.style.color = 'green';
                console.log('로드된 당첨번호 데이터:', historicalWinningNumbers);
                // 번호 빈도 계산 함수 호출
                calculateNumberFrequencies(historicalWinningNumbers);
            } else {
                fileLoadStatus.textContent = '유효한 데이터를 찾을 수 없습니다. CSV 형식을 확인해주세요.';
                fileLoadStatus.style.color = 'red';
            }
        };
        
        reader.onerror = function() {
            fileLoadStatus.textContent = '파일을 읽는 중 오류가 발생했습니다.';
            fileLoadStatus.style.color = 'red';
        };
        
        // 텍스트로 파일 읽기
        reader.readAsText(file);
    }
    
    // 각 번호의 출현 빈도를 계산하는 함수
    function calculateNumberFrequencies(historicalData) {
        // 빈도 객체 초기화
        numberFrequencies = {};
        
        // 1부터 45까지의 모든 번호에 대해 초기 빈도 0으로 설정
        for (let i = 1; i <= 45; i++) {
            numberFrequencies[i] = 0;
        }
        
        // 모든 당첨번호를 하나의 배열로 모음
        const allNumbers = [];
        historicalData.forEach(entry => {
            // 일반 당첨번호 6개 추가
            allNumbers.push(...entry.numbers);
            // 보너스 번호는 포함하지 않음
        });
        
        // 각 번호의 출현 빈도 계산
        allNumbers.forEach(num => {
            if (numberFrequencies[num] !== undefined) {
                numberFrequencies[num]++;
            }
        });
        
        console.log('번호별 출현 빈도:', numberFrequencies);
    }
    
    // CSV 파일 파싱 함수
    function parseCSV(csvText) {
        // CSV 파일의 각 줄을 배열로 분리
        const lines = csvText.split('\n');
        
        // 헤더 행 제거 (첫 번째 줄)
        const dataLines = lines.slice(1);
        
        // 각 행을 파싱하여 당첨번호 객체 생성
        const winningNumbers = [];
        
        dataLines.forEach(line => {
            // 빈 줄 무시
            if (line.trim() === '') return;
            
            // 쉼표로 열 분리
            const columns = line.split(',');
            
            // 필요한 열이 충분히 있는지 확인
            if (columns.length < 8) return;
            
            // 회차 정보 및 번호 추출
            const round = parseInt(columns[0]);
            const numbers = columns.slice(1, 7).map(num => parseInt(num.trim()));
            const bonus = parseInt(columns[7].trim());
            
            // 유효한 데이터만 추가 (모든 번호가 숫자인 경우)
            if (!isNaN(round) && numbers.every(num => !isNaN(num)) && !isNaN(bonus)) {
                winningNumbers.push({
                    round,
                    numbers,
                    bonus
                });
            }
        });
        
        return winningNumbers;
    }
    
    // 제외할 번호 그리드 생성 함수
    function createExcludeNumbersGrid() {
        const gridContainer = document.getElementById('exclude-numbers-grid');
        if (!gridContainer) return;
        
        // 1부터 45까지의 번호 버튼 생성
        for (let i = 1; i <= 45; i++) {
            const button = document.createElement('div');
            button.className = 'number-button';
            button.id = `num-${i}`;
            button.textContent = i;
            button.dataset.number = i;
            
            // 클릭 이벤트 리스너 추가
            button.addEventListener('click', function() {
                this.classList.toggle('selected');
            });
            
            gridContainer.appendChild(button);
        }
    }
    
    // 조합 개수 선택 드롭다운 옵션 생성 함수
    function createCombinationCountOptions() {
        const combinationCountSelect = document.getElementById('combination-count');
        
        if (combinationCountSelect) {
            for (let i = 1; i <= 50; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                combinationCountSelect.appendChild(option);
            }
        } else {
            console.error('ID가 "combination-count"인 select 요소를 찾을 수 없습니다.');
        }
    }
    
    // 번호 생성 버튼 클릭 처리 함수
    function generateLottoNumbers() {
        console.log("번호 생성 버튼 클릭됨!");
        
        // 1. 결과 영역 초기화
        const resultsArea = document.getElementById('results-area');
        resultsArea.innerHTML = '';
        
        // 생성된 조합 배열 초기화
        currentGeneratedCombinations = [];
        
        // 2. 선택된 제외 번호 가져오기
        const selectedExcludeButtons = document.querySelectorAll('.number-button.selected');
        const excludedNumbers = new Set();
        
        selectedExcludeButtons.forEach(button => {
            const number = parseInt(button.dataset.number);
            if (number >= 1 && number <= 45) {
                excludedNumbers.add(number);
            }
        });
        
        console.log("제외할 번호 목록:", [...excludedNumbers]);
        
        // 1부터 45까지의 모든 숫자 배열 생성
        const allPossibleNumbers = Array.from({ length: 45 }, (_, i) => i + 1);
        
        // 제외할 번호를 제외한 사용 가능한 번호들
        const availableNumbers = allPossibleNumbers.filter(num => !excludedNumbers.has(num));
        console.log("사용 가능한 번호 풀:", availableNumbers);
        
        // 새 조합 생성 가능 여부 확인
        if (availableNumbers.length < 6) {
            resultsArea.innerHTML = '<p>제외할 번호가 너무 많아 새로운 조합을 생성할 수 없습니다.</p>';
            return;
        }
        
        // 3. 생성할 조합 개수 결정
        const combinationCountSelect = document.getElementById('combination-count');
        const numberOfCombinationsToGenerate = parseInt(combinationCountSelect.value);
        console.log(`생성할 조합 개수: ${numberOfCombinationsToGenerate}`);
        
        // 마지막 생성 개수 저장
        lastNumberOfCombinationsToGenerate = numberOfCombinationsToGenerate;
        
        // 4. 유효성 검사: 생성할 조합 개수가 유효한지 확인
        if (numberOfCombinationsToGenerate <= 0) {
            resultsArea.innerHTML = '<p>생성할 조합 개수는 1 이상이어야 합니다.</p>';
            return;
        }
        
        // 5. 새로운 로또 번호 조합 생성
        
        // 요청한 조합 개수만큼 반복
        for (let i = 0; i < numberOfCombinationsToGenerate; i++) {
            // 매 반복마다 availableNumbers 개수 재확인
            if (availableNumbers.length < 6) {
                resultsArea.innerHTML += '<p>사용 가능한 숫자가 부족하여 요청한 모든 조합을 생성하지 못했습니다.</p>';
                break;
            }
            
            // availableNumbers 배열 복사 및 섞기
            const shuffledNumbers = shuffleArray([...availableNumbers]);
            
            // 앞에서부터 6개 숫자 선택
            const newCombination = shuffledNumbers.slice(0, 6);
            
            // 선택된 숫자 오름차순 정렬
            newCombination.sort((a, b) => a - b);
            
            // 생성된 조합 배열에 추가
            currentGeneratedCombinations.push(newCombination);
        }
        
        // 6. 생성된 조합 결과 표시
        if (currentGeneratedCombinations.length === 0) {
            resultsArea.innerHTML = '<p>생성된 조합이 없습니다.</p>';
            return;
        } 
        
        // 제목 추가
        const resultTitle = document.createElement('h3');
        resultTitle.textContent = '생성된 로또 번호 조합';
        resultsArea.appendChild(resultTitle);
        
        // 각 조합을 결과 영역에 표시
        currentGeneratedCombinations.forEach((combination, index) => {
            const combinationDiv = document.createElement('div');
            combinationDiv.textContent = `조합 ${index + 1}: ${combination.join(', ')}`;
            combinationDiv.style.margin = '10px 0';
            combinationDiv.style.padding = '8px';
            combinationDiv.style.backgroundColor = '#f0f0f0';
            combinationDiv.style.borderRadius = '4px';
            resultsArea.appendChild(combinationDiv);
        });
        
        // 7. 역대 회차별 당첨 시뮬레이션 결과 제목 추가
        const simulationTitle = document.createElement('h4');
        simulationTitle.textContent = '역대 회차별 당첨 시뮬레이션 결과:';
        simulationTitle.style.marginTop = '30px';
        resultsArea.appendChild(simulationTitle);
        
        // 8. 로드된 데이터 확인
        if (historicalWinningNumbers.length === 0) {
            const noDataMsg = document.createElement('p');
            noDataMsg.textContent = 'CSV 파일을 먼저 로드해주세요.';
            noDataMsg.style.color = 'red';
            resultsArea.appendChild(noDataMsg);
            return;
        }
        
        // 9. 각 역대 당첨 회차에 대한 시뮬레이션 수행
        historicalWinningNumbers.forEach(historicalEntry => {
            // a. 현재 회차에 대한 당첨 통계 초기화
            const currentRoundRankCounts = {
                "1등": 0,
                "2등": 0,
                "3등": 0,
                "4등": 0,
                "5등": 0
            };
            
            // b. 생성된 각 조합에 대한 당첨 여부 확인
            currentGeneratedCombinations.forEach(combo => {
                // i. 현재 조합과 역대 당첨번호 비교
                const comparisonResult = compareNumbers(combo, historicalEntry);
                
                // ii. 등수 판별
                const rank = getPrizeRank(comparisonResult.mainMatchCount, comparisonResult.bonusInGenerated);
                
                // iii. 낙첨이 아니면 해당 등수 카운트 증가
                if (rank !== "낙첨") {
                    currentRoundRankCounts[rank]++;
                }
            });
            
            // c. 당첨된 총 조합 수 계산
            const totalWinsThisRound = Object.values(currentRoundRankCounts).reduce((sum, count) => sum + count, 0);
            
            // d. 적중률 계산
            const hitRateThisRound = (numberOfCombinationsToGenerate > 0) ? 
                (totalWinsThisRound / numberOfCombinationsToGenerate) * 100 : 0;
            
            // e. 결과 문자열 생성
            let resultText = '';
            if (totalWinsThisRound === 0) {
                resultText = `${historicalEntry.round}회: 당첨 없음`;
            } else {
                resultText = `${historicalEntry.round}회: 총 ${totalWinsThisRound}개 당첨 (1등: ${currentRoundRankCounts["1등"]}개, 2등: ${currentRoundRankCounts["2등"]}개, 3등: ${currentRoundRankCounts["3등"]}개, 4등: ${currentRoundRankCounts["4등"]}개, 5등: ${currentRoundRankCounts["5등"]}개) - 적중률: ${hitRateThisRound.toFixed(2)}%`;
            }
            
            // f. 결과를 화면에 표시
            const resultElement = document.createElement('p');
            resultElement.textContent = resultText;
            
            // 당첨이 있는 회차는 강조 표시
            if (totalWinsThisRound > 0) {
                resultElement.style.fontWeight = 'bold';
                
                // 1등, 2등이 있으면 특별히 색상으로 강조
                if (currentRoundRankCounts["1등"] > 0) {
                    resultElement.style.color = '#FF0000'; // 빨간색
                } else if (currentRoundRankCounts["2등"] > 0) {
                    resultElement.style.color = '#FF6600'; // 주황색
                }
            }
            
            resultsArea.appendChild(resultElement);
        });
    }
    
    // 배열을 무작위로 섞는 함수
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    // 사용 가능한 번호들을 Hot, Neutral, Cold 그룹으로 나누는 함수
    function categorizeAvailableNumbers(availableNumbers, frequencies) {
        if (availableNumbers.length === 0) {
            return { hot: [], neutral: [], cold: [] };
        }

        // 사용 가능한 번호를 빈도순으로 정렬 (내림차순: 높은 빈도 우선)
        const sortedByFreq = [...availableNumbers].sort((a, b) => (frequencies[b] || 0) - (frequencies[a] || 0));

        // 그룹 크기 계산 (전체 번호를 3개 그룹으로 균등히 나눔)
        const groupSize = Math.floor(sortedByFreq.length / 3);
        
        // 그룹 나누기
        const hot = sortedByFreq.slice(0, groupSize);  // 빈도 상위 1/3
        const cold = sortedByFreq.slice(sortedByFreq.length - groupSize);  // 빈도 하위 1/3
        const neutral = sortedByFreq.slice(groupSize, sortedByFreq.length - groupSize);  // 나머지 중간 빈도

        // 엣지 케이스: 번호가 3개 미만인 경우
        if (availableNumbers.length < 3 && availableNumbers.length > 0) {
            return { hot: [...sortedByFreq], neutral: [], cold: [] };
        }

        return { hot, neutral, cold };
    }

    // 특정 그룹에서 무작위로 n개의 유니크한 번호를 선택하는 함수
    function getRandomUniqueNumbersFromGroup(group, count, pickedNumbersSet) {
        const selected = [];
        // 그룹 내 번호들을 무작위로 섞기
        const shuffledGroup = [...group].sort(() => 0.5 - Math.random());
        
        // 필요한 개수만큼 번호 선택
        for (const num of shuffledGroup) {
            if (selected.length < count && !pickedNumbersSet.has(num)) {
                selected.push(num);
                pickedNumbersSet.add(num); // 전체 조합 내에서 중복 방지
            }
            if (selected.length === count) break;
        }
        
        return selected;
    }
    
    // 생성된 로또 번호와 기존 당첨 번호를 비교하는 함수
    function compareNumbers(generatedCombo, historicalSet) {
        // generatedCombo의 숫자 중 historicalSet.numbers에 포함된 개수 계산
        const mainMatchCount = generatedCombo.filter(num => 
            historicalSet.numbers.includes(num)
        ).length;
        
        // historicalSet.bonus 번호가 generatedCombo에 포함되어 있는지 확인
        const bonusInGenerated = generatedCombo.includes(historicalSet.bonus);
        
        // 결과 객체 반환
        return {
            mainMatchCount,
            bonusInGenerated
        };
    }
    
    // 일치하는 번호 개수와 보너스 번호 포함 여부를 바탕으로 로또 등수를 판별하는 함수
    function getPrizeRank(mainMatchCount, bonusInGenerated) {
        if (mainMatchCount === 6) {
            return "1등";
        } else if (mainMatchCount === 5) {
            if (bonusInGenerated) {
                return "2등";
            } else {
                return "3등";
            }
        } else if (mainMatchCount === 4) {
            return "4등";
        } else if (mainMatchCount === 3) {
            return "5등";
        } else {
            return "낙첨";
        }
    }
    
    // 생성된 조합과 역대 당첨번호를 비교하여 분석 결과를 표시하는 함수
    function analyzeGeneratedNumbers(generatedCombinations) {
        // 결과 요약 정보를 저장할 객체
        const prizeCountSummary = {
            "1등": 0,
            "2등": 0,
            "3등": 0,
            "4등": 0,
            "5등": 0,
            "낙첨": 0
        };
        
        // 각 생성된 조합에 대해
        generatedCombinations.forEach(combo => {
            // 모든 역대 당첨번호와 비교
            historicalWinningNumbers.forEach(historicalSet => {
                // 일치하는 번호 수와 보너스 번호 포함 여부 체크
                const comparison = compareNumbers(combo, historicalSet);
                // 등수 판별
                const rank = getPrizeRank(comparison.mainMatchCount, comparison.bonusInGenerated);
                // 등수별 카운트 증가
                prizeCountSummary[rank]++;
            });
        });
        
        // 결과 표시를 위한 참조
        const resultsArea = document.getElementById('results-area');
        
        // 결과 표시
        const analysisTitle = document.createElement('h3');
        analysisTitle.textContent = '역대 당첨번호 비교 분석';
        analysisTitle.style.marginTop = '30px';
        resultsArea.appendChild(analysisTitle);
        
        const analysisDescription = document.createElement('p');
        analysisDescription.textContent = `생성된 ${generatedCombinations.length}개의 조합이 역대 ${historicalWinningNumbers.length}회 당첨번호와 비교했을 때:`;
        resultsArea.appendChild(analysisDescription);
        
        // 등수별 집계 결과 표시
        const rankList = document.createElement('ul');
        for (const [rank, count] of Object.entries(prizeCountSummary)) {
            const rankItem = document.createElement('li');
            const totalComparisons = generatedCombinations.length * historicalWinningNumbers.length;
            const percentage = (count / totalComparisons * 100).toFixed(2);
            rankItem.textContent = `${rank}: ${count}회 (${percentage}%)`;
            rankList.appendChild(rankItem);
        }
        resultsArea.appendChild(rankList);
    }
    
    // AI 기반 로또 번호 생성 함수
    function generateAILottoNumbers() {
        console.log("AI 번호 생성 버튼 클릭됨!");
        
        // 1. 결과 영역 초기화
        const resultsArea = document.getElementById('results-area');
        resultsArea.innerHTML = '';
        
        // 생성된 조합 배열 초기화
        currentGeneratedCombinations = [];
        
        // 2. 선택된 제외 번호 가져오기
        const selectedExcludeButtons = document.querySelectorAll('.number-button.selected');
        const excludedNumbers = new Set();
        
        selectedExcludeButtons.forEach(button => {
            const number = parseInt(button.dataset.number);
            if (number >= 1 && number <= 45) {
                excludedNumbers.add(number);
            }
        });
        
        console.log("제외할 번호 목록:", [...excludedNumbers]);
        
        // 1부터 45까지의 모든 숫자 배열 생성
        const allPossibleNumbers = Array.from({ length: 45 }, (_, i) => i + 1);
        
        // 제외할 번호를 제외한 사용 가능한 번호들
        const availableNumbers = allPossibleNumbers.filter(num => !excludedNumbers.has(num));
        console.log("사용 가능한 번호 풀:", availableNumbers);
        
        // 새 조합 생성 가능 여부 확인
        if (availableNumbers.length < 6) {
            resultsArea.innerHTML = '<p>제외할 번호가 너무 많아 새로운 조합을 생성할 수 없습니다.</p>';
            return;
        }
        
        // 3. 생성할 조합 개수 결정
        const combinationCountSelect = document.getElementById('combination-count');
        const numberOfCombinationsToGenerate = parseInt(combinationCountSelect.value);
        console.log(`생성할 조합 개수: ${numberOfCombinationsToGenerate}`);
        
        // 마지막 생성 개수 저장
        lastNumberOfCombinationsToGenerate = numberOfCombinationsToGenerate;
        
        // 4. 유효성 검사: 생성할 조합 개수가 유효한지 확인
        if (numberOfCombinationsToGenerate <= 0) {
            resultsArea.innerHTML = '<p>생성할 조합 개수는 1 이상이어야 합니다.</p>';
            return;
        }
        
        // 5. 번호 빈도 데이터 확인
        if (Object.keys(numberFrequencies).length === 0) {
            resultsArea.innerHTML = '<p>AI 생성: 번호 빈도 데이터가 로드되지 않았습니다. CSV 파일을 먼저 로드해주세요.</p>';
            return;
        }
        
        // 6. AI 번호 생성 로직 - Hot & Cold 기반 접근법
        
        // 번호 분류
        const { hot, neutral, cold } = categorizeAvailableNumbers(availableNumbers, numberFrequencies);
        console.log("AI 분류 - Hot:", hot, "Neutral:", neutral, "Cold:", cold);
        
        // 요청한 조합 개수만큼 반복
        for (let i = 0; i < numberOfCombinationsToGenerate; i++) {
            // 새 조합을 저장할 배열
            let newCombination = [];
            // 현재 조합에 사용된 번호를 추적하는 Set
            let pickedNumbersSet = new Set();
            
            // AI 전략: Hot에서 2개, Neutral에서 2개, Cold에서 2개 선택
            let strategy = [
                { group: hot, count: 2 },
                { group: neutral, count: 2 },
                { group: cold, count: 2 }
            ];
            
            // 각 그룹에서 번호 선택
            strategy.forEach(s => {
                const pickedFromGroup = getRandomUniqueNumbersFromGroup(s.group, s.count, pickedNumbersSet);
                pickedFromGroup.forEach(num => {
                    if (newCombination.length < 6 && !newCombination.includes(num)) {
                        newCombination.push(num);
                    }
                });
            });
            
            // 만약 6개를 채우지 못했다면 (그룹의 크기가 작은 경우)
            if (newCombination.length < 6) {
                const remainingNeeded = 6 - newCombination.length;
                const yetAvailableAndNotPicked = availableNumbers.filter(n => !pickedNumbersSet.has(n));
                const pickedFromRemaining = getRandomUniqueNumbersFromGroup(
                    yetAvailableAndNotPicked, 
                    remainingNeeded, 
                    pickedNumbersSet
                );
                
                pickedFromRemaining.forEach(num => {
                    if (newCombination.length < 6 && !newCombination.includes(num)) {
                        newCombination.push(num);
                    }
                });
            }
            
            // 만약 여전히 6개를 채우지 못했다면 (이론상 발생하지 않아야 함)
            if (newCombination.length < 6) {
                console.warn(`AI 생성: ${i+1}번째 조합 생성 시 6개를 채우지 못했습니다. (${newCombination.length}개). 무작위로 추가합니다.`);
                // 무작위로 다시 생성
                let emergencyPool = [...availableNumbers].sort(() => 0.5 - Math.random());
                newCombination = emergencyPool.slice(0, 6);
            }
            
            // 생성된 번호 오름차순 정렬
            newCombination.sort((a, b) => a - b);
            
            // 생성된 조합 배열에 추가
            currentGeneratedCombinations.push(newCombination);
        }
        
        // 7. 생성된 조합 결과 표시
        if (currentGeneratedCombinations.length === 0) {
            resultsArea.innerHTML = '<p>생성된 조합이 없습니다.</p>';
            return;
        } 
        
        // 제목 추가
        const resultTitle = document.createElement('h3');
        resultTitle.textContent = 'AI 생성 로또 번호 조합';
        resultsArea.appendChild(resultTitle);
        
        // 각 조합을 결과 영역에 표시
        currentGeneratedCombinations.forEach((combination, index) => {
            const combinationDiv = document.createElement('div');
            combinationDiv.textContent = `조합 ${index + 1}: ${combination.join(', ')}`;
            combinationDiv.style.margin = '10px 0';
            combinationDiv.style.padding = '8px';
            combinationDiv.style.backgroundColor = '#f0f0f0';
            combinationDiv.style.borderRadius = '4px';
            resultsArea.appendChild(combinationDiv);
        });
        
        // 8. 역대 회차별 당첨 시뮬레이션 결과 제목 추가
        const simulationTitle = document.createElement('h4');
        simulationTitle.textContent = 'AI 생성 조합의 역대 회차별 당첨 시뮬레이션 결과:';
        simulationTitle.style.marginTop = '30px';
        resultsArea.appendChild(simulationTitle);
        
        // 9. 로드된 데이터 확인
        if (historicalWinningNumbers.length === 0) {
            const noDataMsg = document.createElement('p');
            noDataMsg.textContent = 'CSV 파일을 먼저 로드해주세요.';
            noDataMsg.style.color = 'red';
            resultsArea.appendChild(noDataMsg);
            return;
        }
        
        // 10. 각 역대 당첨 회차에 대한 시뮬레이션 수행
        historicalWinningNumbers.forEach(historicalEntry => {
            // a. 현재 회차에 대한 당첨 통계 초기화
            const currentRoundRankCounts = {
                "1등": 0,
                "2등": 0,
                "3등": 0,
                "4등": 0,
                "5등": 0
            };
            
            // b. 생성된 각 조합에 대한 당첨 여부 확인
            let totalWinsThisRound = 0;
            currentGeneratedCombinations.forEach(combo => {
                // i. 현재 조합과 역대 당첨번호 비교
                const comparisonResult = compareNumbers(combo, historicalEntry);
                
                // ii. 등수 판별
                const rank = getPrizeRank(comparisonResult.mainMatchCount, comparisonResult.bonusInGenerated);
                
                // iii. 낙첨이 아니면 해당 등수 카운트 증가
                if (rank !== "낙첨") {
                    currentRoundRankCounts[rank]++;
                    totalWinsThisRound++;
                }
            });
            
            // c. 적중률 계산
            const hitRateThisRound = (numberOfCombinationsToGenerate > 0) ? 
                (totalWinsThisRound / numberOfCombinationsToGenerate) * 100 : 0;
            
            // d. 결과 문자열 생성
            let resultText = '';
            if (totalWinsThisRound === 0) {
                resultText = `${historicalEntry.round}회: 당첨 없음`;
            } else {
                let rankDetails = [];
                for (const rankKey in currentRoundRankCounts) {
                    if (currentRoundRankCounts[rankKey] > 0) {
                        rankDetails.push(`${rankKey}: ${currentRoundRankCounts[rankKey]}개`);
                    }
                }
                resultText = `${historicalEntry.round}회: 총 ${totalWinsThisRound}개 당첨 (${rankDetails.join(', ')}) - 적중률: ${hitRateThisRound.toFixed(2)}%`;
            }
            
            // e. 결과를 화면에 표시
            const resultElement = document.createElement('p');
            resultElement.textContent = resultText;
            
            // 당첨이 있는 회차는 강조 표시
            if (totalWinsThisRound > 0) {
                resultElement.style.fontWeight = 'bold';
                
                // 1등, 2등이 있으면 특별히 색상으로 강조
                if (currentRoundRankCounts["1등"] > 0) {
                    resultElement.style.color = '#FF0000'; // 빨간색
                } else if (currentRoundRankCounts["2등"] > 0) {
                    resultElement.style.color = '#FF6600'; // 주황색
                }
            }
            
            resultsArea.appendChild(resultElement);
        });
    }
    
    // 페이지 로드 완료 시 초기화 함수 실행
    document.addEventListener('DOMContentLoaded', init);
})(); 