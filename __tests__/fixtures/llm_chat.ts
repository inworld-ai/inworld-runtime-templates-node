export const invalidModelProviderPairs = [
  {
    modelName: 'gpt-4o',
    provider: 'inworld',
    expectedError: 'not supported by Inworld provider',
  },
  {
    modelName: 'invalid-model-123',
    provider: 'openai',
    expectedError:
      'openai error: The model `invalid-model-123` does not exist or you do not have access to it.',
  },
  {
    modelName: 'meta-llama/Llama-3.1-70b-Instruct',
    provider: 'openai',
    expectedError: 'openai error: invalid model ID',
  },
  {
    modelName: 'gpt-4o-mini',
    provider: 'invalid-provider',
    expectedError: 'Invalid service provider',
  },
  {
    modelName: 'invalid-model-123',
    provider: 'invalid-provider',
    expectedError: 'Invalid service provider',
  },
];

interface AutoToolChoiceScenario {
  name: string;
  userInput: string;
  expectedTools: string[];
  shouldHaveTools: boolean;
}

export const autoToolChoiceScenarios: AutoToolChoiceScenario[] = [
  {
    name: 'weather queries',
    userInput: 'What is the weather like in San Francisco?',
    expectedTools: ['get_weather({"location":'],
    shouldHaveTools: true,
  },
  {
    name: 'math queries',
    userInput: 'What is 15 + 27?',
    expectedTools: ['calculator({"expression":'],
    shouldHaveTools: true,
  },
  {
    name: 'combined weather and math queries',
    userInput: 'What is the weather in Tokyo and what is 100 * 3?',
    expectedTools: ['get_weather({"location":', 'calculator({"expression":'],
    shouldHaveTools: true,
  },
];

interface WeatherToolScenario {
  name: string;
  userInput: string;
  expectedLocation: string;
}

export const weatherToolScenarios: WeatherToolScenario[] = [
  {
    name: 'explicit weather request',
    userInput: 'What is the weather like in Paris today?',
    expectedLocation: 'Paris',
  },
  {
    name: 'temperature inquiry',
    userInput: 'How hot is it in Miami right now?',
    expectedLocation: 'Miami',
  },
  {
    name: 'forecast question',
    userInput: 'Will it rain in London tomorrow?',
    expectedLocation: 'London',
  },
];

interface CalculatorToolScenario {
  name: string;
  userInput: string;
  expectedExpressions: string[];
}

export const calculatorToolScenarios: CalculatorToolScenario[] = [
  {
    name: 'simple addition',
    userInput: 'What is 15 + 27?',
    expectedExpressions: ['15 + 27'],
  },
  {
    name: 'multiplication problem',
    userInput: 'Calculate 8 times 9',
    expectedExpressions: ['8 * 9'],
  },
  {
    name: 'division query',
    userInput: 'What is 144 divided by 12?',
    expectedExpressions: ['144 / 12'],
  },
  {
    name: 'percentage calculation',
    userInput: 'What is 20% of 150?',
    expectedExpressions: ['0.20 * 150', '0.2 * 150', '150 * 0.20', '150 * 0.2'],
  },
  {
    name: 'word problem',
    userInput: 'If I have 5 apples and buy 3 more, how many do I have total?',
    expectedExpressions: ['5 + 3'],
  },
];

export const usageExamples = {
  basicAutoToolChoice: {
    input: '"What is 15 + 27?"',
    args: [
      '--tools',
      '--toolChoice=auto',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedTools: ['calculator({"expression":'],
  },
  multipleToolsStreaming: {
    input: '"Calculate 100 * 5 and what is the weather in Seattle?"',
    args: [
      '--tools',
      '--toolChoice=required',
      '--stream=true',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedTools: ['calculator({"expression":', 'get_weather({"location":'],
  },
  specificToolChoice: {
    input: '"What is 2 + 2?"',
    args: [
      '--tools',
      '--toolChoice=calculator',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedTools: ['calculator({"expression":'],
  },
  multimodal: {
    input: '"what is in this image?"',
    args: [
      '--imageUrl=https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg',
      '--modelName=gpt-4o',
      '--provider=openai',
    ],
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg',
  },
  defaultParameters: {
    input:
      '"Tell me the weather in Vancouver and evaluate the expression 2 + 2"',
  },
  streamingDisabled: {
    input: '"What is 10 + 5?"',
    args: [
      '--tools',
      '--stream=false',
      '--toolChoice=auto',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedTools: ['calculator({"expression":'],
  },
};
