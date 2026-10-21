const fs = require('fs');

const mockJson = {
    "suites": [
        {
            "title": "smoke\\betSaver\\betSaver.spec.ts",
            "file": "smoke/betSaver/betSaver.spec.ts",
            "specs": [],
            "suites": [
                {
                    "title": "BetSaver Module Tests",
                    "file": "smoke/betSaver/betSaver.spec.ts",
                    "specs": [
                        {
                            "title": "T1 - Verify Betsaver not active",
                            "tests": [
                                {
                                    "results": [
                                        {
                                            "status": "passed",
                                            "duration": 47429
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

const scripts = ['betSaver'];

function parsePlaywrightJSON(jsonReport, scripts) {
    const results = [];
    const suites = jsonReport.suites || [];

    for (const script of scripts) {
        let passed = 0;
        let failed = 0;
        let totalTests = 0;
        let duration = 0;
        let testCases = [];

        const findTests = (suites) => {
            for (const suite of suites) {
                if (suite.file) {
                    console.log(`Checking file: ${suite.file} for script: ${script}`);
                }

                if (suite.file && suite.file.toLowerCase().includes(script.toLowerCase())) {
                    console.log(`MATCH!`);
                    if (suite.specs) {
                        for (const spec of suite.specs) {
                            totalTests++;
                            const testDuration = spec.tests?.[0]?.results?.[0]?.duration || 0;
                            duration += testDuration;
                            const testStatus = spec.tests?.[0]?.results?.[0]?.status || 'unknown';

                            if (testStatus === 'passed' || testStatus === 'expected') passed++;
                            else if (testStatus === 'failed' || testStatus === 'unexpected') failed++;

                            testCases.push({ title: spec.title, status: testStatus });
                        }
                    }
                }

                if (suite.suites && suite.suites.length > 0) {
                    findTests(suite.suites);
                }
            }
        };

        findTests(suites);

        results.push({
            scriptName: script,
            passed,
            failed,
            totalTests
        });
    }

    return results;
}

const output = parsePlaywrightJSON(mockJson, scripts);
console.log(JSON.stringify(output, null, 2));
