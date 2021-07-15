import { TestHub, testExplorerExtensionId, TestAdapter, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestLoadStartedEvent, TestLoadFinishedEvent, RetireEvent, TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';

export type TestEvents = TestLoadStartedEvent | TestLoadFinishedEvent;
export type TestStatesEvents = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent;
export type PossibleTestStates = "unknown" | "failures" | "testoutput" | "tail";

export type TestAccum = { 
    id: number;
    indt: number;
    name: string;
    kind: string;
    children: Array<TestAccum>;
};

function createTestSuite(ta : TestAccum) : TestSuiteInfo | TestInfo {
    if (ta.children.length) {
        let ch = ta.children.map(createTestSuite);
        return {
            "type": "suite",
            "id": ta.id.toString(),
            "label": ta.name,
            "children": ch
        };
    } else {
        return {
            "type": "test",
            "id": ta.id.toString(),
            "label": ta.name
        };
    }
};

export function suiteFromAccums(accumulate : Array<TestAccum>) : TestSuiteInfo | TestInfo {
    let suite : TestSuiteInfo | TestInfo = {"type": "suite", "id": "nothing", "label": "No detected tests", "children": []};
    if (accumulate.length === 1) {
        suite = createTestSuite(accumulate[0]);
    } else {
        suite = {
            "type": "suite",
            "id": "chialisp-tests",
            "label": "All Test Modules",
            "children": accumulate.map(createTestSuite)
        };
    }
    return suite;
}

export function testIds(accumulate : Array<TestAccum>) : Array<string> {
    const result : Array<string> = [];
    function testIds_(accumulate : Array<TestAccum>) {
        accumulate.map((t) => {
            if (t.kind === "Function") {
                result.push(t.id.toString());
            }
            testIds_(t.children);
        });
    }
    testIds_(accumulate);
    return result;
}