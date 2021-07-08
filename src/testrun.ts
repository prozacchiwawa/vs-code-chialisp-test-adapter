import * as vscode from 'vscode';
import { PossibleTestStates, TestStatesEvents } from './testtypes';
import { ExtensionConfiguration } from './config';
import { ProcessRunner } from './processrunner';

export class ChialispTestRun {
	allTests : Array<string>;
	testPath : vscode.WorkspaceFolder;
	runningProcess : undefined | ProcessRunner;

	constructor(td : vscode.WorkspaceFolder, allTests : Array<string>) {
		this.allTests = allTests;
		this.testPath = td;
	}

	cancel() {
		if (this.runningProcess) {
            this.runningProcess.kill();
		}
	}

	async run(config : ExtensionConfiguration, tests : Array<string>, emitState : (event : TestStatesEvents) => void) {
        let testSummary = '';
        let failureNumbers : Array<number> = [];
        let testName = '';
        let testFailedAtFile = '';
        let testFailedAtLine = -1;
        const matchFileAndLine = /File "([^"]+)", line ([0-9]+).*/;

        // Accumulate test output
        let testOutput : Array<string> = [];

        emitState({
            "type": "suite",
            "suite": tests[0],
            "state": "running"
        });

        // We'll knock out failures since we have their names
        const passingTests : any = {};

        this.allTests.map((t) => {
            passingTests[t] = true;
            emitState({
                "type": "test",
                "state": "running",
                "test": t,
            });
        });

        let testState : PossibleTestStates = 'unknown';

        let wsfolder = this.testPath.uri.fsPath;
        const p = new ProcessRunner(config);

        this.runningProcess = p;

        console.log(`running tests in ${wsfolder}...`);
        return await p.run("chialisp", ["test"], wsfolder, (_) => {
            // No stdout handling
        }, (line) => {
            if (testState === "unknown") {
                testState = 'reading_test_header';
                testSummary = line;
                for (var i = 0; i < testSummary.length; i++) {
                    if (testSummary[i] !== '.') {
                        failureNumbers.push(i);
                    }
                }
            } else if (testState === "reading_test_header") {
                if (line.startsWith("=================")) {
                    testState = "reading_test_name";
                } else if (line.startsWith("----------------")) {
                    testState = "final";
                }
            } else if (testState === "reading_test_name") {
                if (line.startsWith("-----------")) {
                    testState = "reading_test_data";
                } else {
                    const splitLine = line.split(' ');
                    if (splitLine.length > 1) {
                        testName = splitLine[1].trim();
                    } else {
                        testName = splitLine[0].trim();
                    }
                    testOutput = [];
                    testFailedAtFile = '';
                    testFailedAtLine = -1;
                }
            } else if (testState === "reading_test_data") {
                const finishTest = () => {
                    emitState({
                        "type": "test",
                        "state": "failed",
                        "file": testFailedAtFile,
                        "line": testFailedAtLine,
                        "message": testOutput.join("\n"),
                        "test": testName,
                    });
                    passingTests[testName] = false;
                };
                if (line.startsWith("=============")) {
                    finishTest();
                    testState = "reading_test_name";
                } else if (line.startsWith("-------------")) {
                    finishTest();
                    testState = "final";
                } else {
                    const matched = line.trim().match(matchFileAndLine);
                    if (matched) {
                        testFailedAtFile = matched[1];
                        testFailedAtLine = parseInt(matched[2]) - 1;
                    }
                    testOutput.push(line);
                }
            }
        }, () => {
            console.log(`Test run exited with ${p.runningProcess?.exitCode}`);
            Object.keys(passingTests).map((k) => {
                if (passingTests[k]) {
                    emitState({
                        "type": "test",
                        "state": "passed",
                        "test": k
                    });
                }
            });
            emitState({"type": "suite", "suite": tests[0], "state": "completed"});
        });
	}
}
