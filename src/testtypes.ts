import { TestHub, testExplorerExtensionId, TestAdapter, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestLoadStartedEvent, TestLoadFinishedEvent, RetireEvent, TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';

export type TestEvents = TestLoadStartedEvent | TestLoadFinishedEvent;
export type TestStatesEvents = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent;
export type PossibleTestStates = "unknown" | "reading_test_header" | "reading_test_name" | "reading_test_data" | "final" | "failed" | "passed";
