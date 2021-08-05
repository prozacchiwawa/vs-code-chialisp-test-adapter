import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { TestAdapter, RetireEvent, TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { StringBufAccumulator } from './stringbuf';
import { TestAccum, TestEvents, TestStatesEvents, suiteFromAccums } from './testtypes';
import { ChialispTestRun } from './testrun';
import { loadExtensionConfiguration } from './config';
import { ProcessRunner } from './processrunner';
import { captureTestLine } from './utilities';

export class ChialispTestAdapter implements TestAdapter {
	testDir : vscode.WorkspaceFolder;
	discoveredTests : Array<TestAccum> = [];
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

        this.testsEmitter.fire({
            "type": "started"
        });

        const p = new ProcessRunner(config);
		let lineno = 0;
		let accumulate : Array<TestAccum> = [];
	
        return await p.run("cdv", ["test","--discover"], this.testDir.uri.fsPath, (line) => {
			let rawLine = captureTestLine(line);

			if (rawLine) {
				lineno += 1;
				if (accumulate.length === 0) {
					accumulate.push({
						id: lineno,
						indt: rawLine.indt,
						kind: rawLine.kind,
						name: rawLine.name,
						children: []
					});
				} else {
					let last = accumulate[accumulate.length - 1];
					while (last.indt > 0 && last.indt >= rawLine.indt) {
						accumulate.pop();
						last = accumulate[accumulate.length - 1];
					}
					const newItem = {
						id: lineno,
						indt: rawLine.indt,
						kind: rawLine.kind,
						name: rawLine.name,
						children: []
					};
					if (newItem.indt > last.indt) {
						last.children.push(newItem);
					}
					accumulate.push(newItem);
				}
			}
        }, (_) => {
            // No stderr handling
        }, () => {
            console.log(`discovery exited with ${p.runningProcess?.exitCode}`);
			this.discoveredTests = accumulate;

			while (accumulate.length > 0 && accumulate[accumulate.length - 1].indt > 0) {
				accumulate.pop();
			}
			let suite = suiteFromAccums(accumulate);
            this.testsEmitter.fire({
                "type": "finished",
                "suite": <TestSuiteInfo>suite
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
		console.log('running with config', config);
		console.log(`run ${tests}`);

		if (this.currentRun) {
			return Promise.resolve();
		} 
		
		this.currentRun = new ChialispTestRun(this.testDir, this.discoveredTests);
		this.testStatesEmitter.fire({"type": "started", "tests": tests});
		await this.currentRun.run(config, tests, (e) => {
			this.testStatesEmitter.fire(e);
		});
        this.testStatesEmitter.fire({"type": "finished"});
        this.currentRun = undefined;
	}

	dispose() {
		this.cancel();
	}
}
