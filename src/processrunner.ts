import * as child_process from 'child_process';
import { posix } from 'path';
import { ExtensionConfiguration } from './config';
import { StringBufAccumulator } from './stringbuf';

export class ProcessRunner {
    config : ExtensionConfiguration;
    runningProcess : child_process.ChildProcess | undefined;

    constructor(config : ExtensionConfiguration) {
        this.config = config;
    }

    kill() {
        if (this.runningProcess) {
            this.runningProcess.kill("SIGTERM");
            this.runningProcess = undefined;
        }
    }

    async run(command : string, args : Array<string>, cwd : string, processStdoutLine : (line : string) => void, processStderrLine : (line : string) => void, processClose : () => void) {
        let origpath = process.env["PATH"];
        let newenv = Object.assign({}, process.env, this.config.env);
        console.log('config', this.config);
        newenv["PATH"] = origpath + ":" + this.config.env["PATH"];
        console.log("path", newenv["PATH"]);
        newenv["PYTHONUNBUFFERED"] = "1";

        const stdoutReceiver = new StringBufAccumulator();
        const stderrReceiver = new StringBufAccumulator();

        const p = child_process.spawn(command, args, {
            cwd: cwd,
            env: newenv
        });

        this.runningProcess = p;

        p.stdout.on("data", (chunk) => stdoutReceiver.addChunk(chunk, processStdoutLine));
        p.stderr.on("data", (chunk) => stderrReceiver.addChunk(chunk, processStderrLine));

        await new Promise<void>((resolve, reject) => {
            p.stdout.on("close", () => {
                processClose();
                this.runningProcess = undefined;
                resolve();
            });
        });
    }
}