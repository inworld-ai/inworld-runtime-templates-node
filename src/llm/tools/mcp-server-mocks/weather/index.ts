import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Mock weather data for different cities
 */
const MOCK_WEATHER_DATA: Record<
  string,
  { temperature: number; conditions: string; humidity: number }
> = {
  'san francisco': {
    temperature: 18,
    conditions: 'Partly Cloudy',
    humidity: 65,
  },
  'new york': { temperature: 22, conditions: 'Sunny', humidity: 55 },
  london: { temperature: 15, conditions: 'Rainy', humidity: 80 },
  tokyo: { temperature: 24, conditions: 'Clear', humidity: 60 },
  paris: { temperature: 20, conditions: 'Cloudy', humidity: 70 },
};

/**
 * Mock forecast data for different cities
 */
const MOCK_FORECAST_DATA: Record<
  string,
  Array<{ day: string; temperature: number; conditions: string }>
> = {
  'san francisco': [
    { day: 'Today', temperature: 18, conditions: 'Partly Cloudy' },
    { day: 'Tomorrow', temperature: 20, conditions: 'Sunny' },
    { day: 'Day 3', temperature: 19, conditions: 'Sunny' },
  ],
  'new york': [
    { day: 'Today', temperature: 22, conditions: 'Sunny' },
    { day: 'Tomorrow', temperature: 23, conditions: 'Sunny' },
    { day: 'Day 3', temperature: 21, conditions: 'Partly Cloudy' },
  ],
  london: [
    { day: 'Today', temperature: 15, conditions: 'Rainy' },
    { day: 'Tomorrow', temperature: 14, conditions: 'Rainy' },
    { day: 'Day 3', temperature: 16, conditions: 'Cloudy' },
  ],
  tokyo: [
    { day: 'Today', temperature: 24, conditions: 'Clear' },
    { day: 'Tomorrow', temperature: 25, conditions: 'Clear' },
    { day: 'Day 3', temperature: 23, conditions: 'Partly Cloudy' },
  ],
  paris: [
    { day: 'Today', temperature: 20, conditions: 'Cloudy' },
    { day: 'Tomorrow', temperature: 19, conditions: 'Rainy' },
    { day: 'Day 3', temperature: 21, conditions: 'Partly Cloudy' },
  ],
};

/**
 * Simple Weather MCP Server
 * Provides mock weather data for demonstration purposes
 */
class WeatherMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'WeatherServer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  /**
   * Set up the request handlers for the MCP server
   */
  private setupHandlers() {
    // Handler for listing available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_weather',
            description:
              'Get current weather information for a city. Returns temperature, conditions, and humidity.',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description:
                    'The city name (e.g., "San Francisco", "New York", "London")',
                },
              },
              required: ['city'],
            },
          } as Tool,
          {
            name: 'get_forecast',
            description: 'Get a 3-day weather forecast for a city.',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description:
                    'The city name (e.g., "San Francisco", "New York", "London")',
                },
                days: {
                  type: 'number',
                  description: 'Number of days to forecast (1-3)',
                  default: 3,
                },
              },
              required: ['city'],
            },
          } as Tool,
        ],
      };
    });

    // Handler for tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'get_weather') {
        const city = ((args?.city as string) || '').toLowerCase();
        const weatherData = MOCK_WEATHER_DATA[city];

        if (!weatherData) {
          return {
            content: [
              {
                type: 'text',
                text: `Weather data not available for "${city}". Available cities: ${Object.keys(MOCK_WEATHER_DATA).join(', ')}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Current weather in ${city}:\n- Temperature: ${weatherData.temperature}°C\n- Conditions: ${weatherData.conditions}\n- Humidity: ${weatherData.humidity}%`,
            },
          ],
        };
      }

      if (name === 'get_forecast') {
        const city = ((args?.city as string) || '').toLowerCase();
        const days = Math.min(3, Math.max(1, (args?.days as number) || 3));
        const forecastData = MOCK_FORECAST_DATA[city];

        if (!forecastData) {
          return {
            content: [
              {
                type: 'text',
                text: `Forecast data not available for "${city}". Available cities: ${Object.keys(MOCK_FORECAST_DATA).join(', ')}`,
              },
            ],
          };
        }

        const forecast = forecastData.slice(0, days);
        const forecastText = forecast
          .map((day) => `${day.day}: ${day.temperature}°C, ${day.conditions}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `${days}-day forecast for ${city}:\n${forecastText}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    });
  }

  /**
   * Start the server with stdio transport
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Weather MCP Server running on stdio');
  }
}

// Start the server
const server = new WeatherMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
