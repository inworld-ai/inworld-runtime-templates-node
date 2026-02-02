export const invalidInputs = [
  { '': 'You need to provide a JSON string with user data.' },
  {
    Hello:
      'Invalid JSON string provided: Unexpected token \'H\', "Hello" is not valid JSON',
  },
  { '{}': "JSON data must include 'city' and 'activity' fields." },
  {
    '"{\\\"test\\\": \\\"test\\\"}"':
      "JSON data must include 'city' and 'activity' fields.",
  },
];

interface WeatherToolScenario {
  name: string;
  city: string;
  activity: string;
  expectedLocation: string;
}

export const weatherToolScenarios: WeatherToolScenario[] = [
  {
    name: 'explicit weather request',
    city: 'Paris',
    activity: 'walk',
    expectedLocation: 'Paris',
  },
  {
    name: 'temperature inquiry',
    city: 'Miami',
    activity: 'swim',
    expectedLocation: 'Miami',
  },
];

export const usageExamples = {
  basicAutoToolChoice: {
    input: '"{\\\"city\\\": \\\"Paris\\\", \\\"activity\\\": \\\"walk\\\"}"',
    args: ['--toolChoice=auto', '--modelName=gpt-4o-mini', '--provider=openai'],
    expectedTools: ['get_weather({"location":'],
  },
  specificToolChoice: {
    input: '"{\\\"city\\\": \\\"Paris\\\", \\\"activity\\\": \\\"walk\\\"}"',
    args: [
      '--toolChoice=get_weather',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedTools: ['get_weather({"location":'],
  },
  multimodal: {
    input: '"{\\\"city\\\": \\\"London\\\", \\\"activity\\\": \\\"walk\\\"}"',
    args: [
      '--imageUrl="https://cms.inspirato.com/ImageGen.ashx?image=%2fmedia%2f5682444%2fLondon_Dest_16531610X.jpg"',
      '--modelName=gpt-4o',
      '--provider=openai',
    ],
  },
  defaultParameters: {
    input:
      '"{\\\"city\\\": \\\"San Francisco\\\", \\\"activity\\\": \\\"hiking\\\"}"',
  },
};
