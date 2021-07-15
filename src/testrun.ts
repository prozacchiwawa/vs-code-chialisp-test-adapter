import * as vscode from 'vscode';
import { PossibleTestStates, TestAccum, TestStatesEvents } from './testtypes';
import { ExtensionConfiguration } from './config';
import { ProcessRunner } from './processrunner';
import { suiteFromAccums, testIds } from './testtypes';

const failuresRegex = /[=]+ FAILURES [=]+/;
const testNameRegex = /[_]+ ([^ ]+) [_]+/;
const summaryRegex = /[=]+ short test summary info [=]+/;
const fileAndLineRegex = /([^"]+):([0-9]+): (.*)/;

export class ChialispTestRun {
	allTests : Array<TestAccum> = [];
	testPath : vscode.WorkspaceFolder;
	runningProcess : undefined | ProcessRunner;

	constructor(td : vscode.WorkspaceFolder, tests : Array<TestAccum>) {
        this.allTests = tests;
		this.testPath = td;
	}

	cancel() {
		if (this.runningProcess) {
            this.runningProcess.kill();
		}
	}

    findTestIdInAccum(name : string, prefix : string, accum : TestAccum) : string | null {
        if (prefix + accum.name === name) {
            return accum.id.toString();
        }
        if (accum.kind === 'Class') {
            prefix = prefix + accum.name + '.';
        }
        for (var i = 0; i < accum.children.length; i++) {
            let ta = accum.children[i];
            const resultInTestSet = this.findTestIdInAccum(name, prefix, ta);
            if (resultInTestSet) {
                return resultInTestSet;
            }
        }
        return null;
    }

    findTestId(name : string) : string | null {
        for (var i = 0; i < this.allTests.length; i++) {
            let ta = this.allTests[i];
            const resultInTestSet = this.findTestIdInAccum(name, "", ta);
            if (resultInTestSet) {
                return resultInTestSet;
            }
        }
        return null;
    }

	async run(config : ExtensionConfiguration, tests : Array<string>, emitState : (event : TestStatesEvents) => void) {
        let testSummary = '';
        let failureNumbers : Array<number> = [];
        let testName = '';
        let testFailedAtFile = '';
        let testFailedAtLine = -1;

        let testOutput : Array<string> = [];

        let suite = suiteFromAccums(this.allTests);

        emitState({
            "type": "suite",
            "suite": <any>suite,
            "state": "running"
        });

        // We'll knock out failures since we have their names
        const passingTests : any = {};
        testIds(this.allTests).map((t) => {
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
        const finishTest = () => {
            if (testOutput.length > 0) {
                const f = testOutput[testOutput.length - 1].match(fileAndLineRegex);
                if (f) {
                    testFailedAtFile = f[1];
                    testFailedAtLine = parseInt(f[2]);
                }                
            }
            const finalId = this.findTestId(testName);
            if (finalId) {
                emitState({
                    "type": "test",
                    "state": "failed",
                    "file": testFailedAtFile,
                    "line": testFailedAtLine,
                    "message": testOutput.join("\n"),
                    "test": finalId,
                });
                passingTests[finalId] = false;
            }
        };

        const startTest = (name : string) => {
            testName = name;
            testOutput = [];
            testFailedAtFile = '';
            testFailedAtLine = -1;
            testState = 'testoutput';
        };

        console.log(`running tests in ${wsfolder}...`);
        return await p.run("chialisp", ["test"], wsfolder, (line) => {
            const summary = line.match(summaryRegex);
            if (summary) {
                if (testOutput.length > 0) {
                    finishTest();
                }
                testState = 'tail';
            } else if (testState === "unknown") {
                let matched = line.match(failuresRegex);
                if (matched) {
                    testState = 'failures';                    
                }
            } else if (testState === "failures") {
                const testHeading = line.match(testNameRegex);
                if (testHeading) {
                    startTest(testHeading[1]);
                }
            } else if (testState === "testoutput") {
                const nextName = line.match(testNameRegex);
                if (nextName) {
                    finishTest();
                    startTest(nextName[1]);
                } else {
                    testOutput.push(line);
                }
            }
        }, (line) => {
            console.log('stderr', line);
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
