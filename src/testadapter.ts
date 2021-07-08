import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { TestAdapter, RetireEvent, TestInfo } from 'vscode-test-adapter-api';

import { StringBufAccumulator } from './stringbuf';
import { TestEvents, TestStatesEvents } from './testtypes';
import { ChialispTestRun } from './testrun';
import { loadExtensionConfiguration } from './config';
import { ProcessRunner } from './processrunner';

export class ChialispTestAdapter implements TestAdapter {
	testDir : vscode.WorkspaceFolder;
	discoveredTests : Array<string> = [];
	currentRun : ChialispTestRun | undefined;

	private readonly testsEmitter : vscode.EventEmitter<TestEvents> = new vscode.EventEmitter<TestEvents>();
	private readonly testStatesEmitter : vscode.EventEmitter<TestStatesEvents> = new vscode.EventEmitter<TestStatesEvents>();
	private readonly retireEmitter : vscode.EventEmitter<RetireEvent> = new vscode.EventEmitter<RetireEvent>();
    
	get tests() {
		return this.testsEmitter.event;
	}

	get testStates() {
		return this.testStatesEmitter.event;
	} 

	get retire() {
		return this.retireEmitter.event;
	}

	constructor(td : vscode.WorkspaceFolder) {
		console.log(`chialisp test adapter for ${td.uri.fsPath}`);
		this.testDir = td;
	}

	async load() : Promise<void> {
		console.log(`load ${this.testDir.uri.fsPath}`);

        // Run the test discovery and resolve the load promise when we've got the test list.
        const config = await loadExtensionConfiguration(this.testDir);
        const stdoutList : Array<string> = [];

        this.testsEmitter.fire({
            "type": "started"
        });

        const p = new ProcessRunner(config);
        return await p.run("chialisp", ["test","--discover"], this.testDir.uri.fsPath, (line) => {
            stdoutList.push(line.trimRight());
        }, (_) => {
            // No stderr handling
        }, () => {
            console.log(`discovery exited with ${p.runningProcess?.exitCode}`);
            const testSuite : Array<TestInfo> = [];
            this.discoveredTests = stdoutList;
            stdoutList.map((l) => {
                testSuite.push({
                    "type": "test",
                    "id": l.trim(),
                    "label": l.trim()
                });
            });
            this.testsEmitter.fire({
                "type": "finished",
                "suite": {
                    "type": "suite",
                    "id": "chialisp-tests",
                    "label": "chialisp tests",
                    "children": testSuite
                }
            });
            this.retireEmitter.fire({});
        });
	}

	cancel() {
		console.log('cancel');
		if (this.currentRun) {
			this.currentRun.cancel();
			this.currentRun = undefined;
		}
	}

	async run(tests : Array<string>) {
        const config = await loadExtensionConfiguration(this.testDir);
		console.log(`run ${tests}`);

		if (this.currentRun) {
			return Promise.resolve();
		} 
		
		this.currentRun = new ChialispTestRun(this.testDir, this.discoveredTests);
		this.testStatesEmitter.fire({"type": "started", "tests": tests});
		await this.currentRun.run(config, tests, (e) => this.testStatesEmitter.fire(e));
        this.testStatesEmitter.fire({"type": "finished"});
        this.currentRun = undefined;
	}

	dispose() {
		this.cancel();
	}
}
