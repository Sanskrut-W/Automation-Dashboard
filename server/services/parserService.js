// Helper function to parse Playwright JSON output
function parsePlaywrightJSON(jsonReport, scripts) {
    const results = [];
    console.log('[DEBUG] --------------------------------------------------');
    console.log(`[DEBUG] Parsing JSON. Target Scripts (${scripts.length}):`, JSON.stringify(scripts));

    // Navigate through Playwright's JSON structure
    const suites = jsonReport.suites || [];
    console.log(`[DEBUG] JSON Root Suites count: ${suites.length}`);
    if (suites.length > 0) {
        console.log(`[DEBUG] First suite title: ${suites[0].title}, file: ${suites[0].file}`);
    }

    for (const script of scripts) {
        let passed = 0;
        let failed = 0;
        let totalTests = 0;
        let duration = 0;
        let testCases = [];
        let matchFound = false;

        // Find the suite for this script
        const findTests = (currentSuites, depth = 0) => {
            const indent = '  '.repeat(depth);
            for (const suite of currentSuites) {
                // Determine if this suite matches
                const file = suite.file || '';
                const title = suite.title || '';

                // Only log matches or high-level traversal to avoid massive spam
                const isMatch = file && file.toLowerCase().includes(script.toLowerCase());

                if (isMatch) {
                    console.log(`[DEBUG] ${indent}MATCH FOUND! Script '${script}' matches File '${file}'`);
                    matchFound = true;
                    // Process specs in this suite
                    if (suite.specs) {
                        for (const spec of suite.specs) {
                            totalTests++;
                            const testDuration = spec.tests?.[0]?.results?.[0]?.duration || 0;
                            duration += testDuration;

                            const testStatus = spec.tests?.[0]?.results?.[0]?.status || 'unknown';
                            const testTitle = spec.title || 'Unknown Test';

                            if (testStatus === 'passed' || testStatus === 'expected') {
                                passed++;
                            } else if (testStatus === 'failed' || testStatus === 'unexpected') {
                                failed++;
                            }

                            testCases.push({
                                title: testTitle,
                                status: testStatus,
                                duration: testDuration
                            });
                        }
                    }
                }

                // Recursively search in nested suites
                if (suite.suites && suite.suites.length > 0) {
                    findTests(suite.suites, depth + 1);
                }
            }
        };

        findTests(suites);

        if (!matchFound) {
            console.log(`[DEBUG] No match found for script '${script}' in any suite.`);
        }

        results.push({
            scriptName: script,
            passed,
            failed,
            totalTests,
            duration: Math.round(duration),
            testCases // Include individual test case details
        });
    }
    console.log('[DEBUG] --------------------------------------------------');

    return results;
}

// Helper function to parse Playwright output for per-script results (fallback)
function parsePlaywrightResults(output, scripts) {
    const results = [];

    // Try to parse from Playwright output
    // Playwright typically outputs: "X passed (Ys)" or "X failed"
    // We'll use regex to extract test counts per script

    for (const script of scripts) {
        let passed = 0;
        let failed = 0;
        let duration = 0;

        // Look for patterns like: "tests/modules/scriptName/scriptName.spec.ts"
        const scriptPattern = new RegExp(`${script}.*?spec\\.ts`, 'i');
        const lines = output.split('\n');

        // Try to find summary lines for this script
        // Playwright format: "  5 passed (2.3s)"
        const passedMatch = output.match(new RegExp(`(\\d+)\\s+passed.*?${script}`, 'i'));
        const failedMatch = output.match(new RegExp(`(\\d+)\\s+failed.*?${script}`, 'i'));
        const durationMatch = output.match(new RegExp(`${script}.*?\\((\\d+\\.?\\d*)s\\)`, 'i'));

        if (passedMatch) passed = parseInt(passedMatch[1]);
        if (failedMatch) failed = parseInt(failedMatch[1]);
        if (durationMatch) duration = Math.round(parseFloat(durationMatch[1]) * 1000);

        // If we couldn't parse, estimate based on overall status
        // This is a fallback - in production you'd want more robust parsing
        if (passed === 0 && failed === 0) {
            // Leave as 0 if parsing failed
            // passed = 0; 
            // failed = 0;
        }

        results.push({
            scriptName: script,
            passed,
            failed,
            totalTests: passed + failed,
            duration
        });
    }

    return results;
}

module.exports = {
    parsePlaywrightJSON,
    parsePlaywrightResults
};
