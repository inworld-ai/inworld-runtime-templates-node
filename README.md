# Inworld Runtime Templates

Welcome to the Inworld Runtime templates! These examples demonstrate how to build AI applications using the Inworld Runtime SDK, from simple LLM calls to complete voice agent applications.

## 🗂️ What's Inside

The templates are organized by feature domain:

### 🤖 [llm/](src/llm/)
LLM operations, routing, and tools.
- LLM chat and completion
- Component registry patterns
- Random canned responses
- **[routing/](src/llm/routing/)** - Intelligent routing and conditional logic
- **[tools/](src/llm/tools/)** - Function calling and MCP integration

### 🎙️ [voice/](src/voice/)
Voice processing and synthesis.
- Speech-to-text (STT)
- Text-to-speech (TTS)
- TTS with custom components
- Streaming TTS

### 🚀 [advanced/](src/advanced/)
Advanced examples and patterns.
- Character generation

### 📚 [retrieval/](src/retrieval/)
RAG, search, intent matching, and long-term memory.
- Knowledge retrieval
- Intent matching and routing
- Long-term memory integration
- Semantic search

### 🛡️ [safety/](src/safety/)
Content moderation and filtering.
- Keyword matching
- Text classification
- Safety pipelines

### 🌊 [streaming/](src/streaming/)
Real-time streaming for text and audio.
- LLM streaming with abort control
- Text and audio stream processing
- Stream slicers and joiners

### ✂️ [text_processing/](src/text_processing/)
Text transformation and template rendering.
- Text chunking
- Jinja template rendering
- Custom transformations
- Subgraph patterns

### 📊 [observability/](src/observability/)
Telemetry, metrics, and monitoring.
- **[basics/](src/observability/basics/)** - Basic telemetry setup
- **[advanced/](src/observability/advanced/)** - Custom OTEL integrations
- **[metrics/](src/observability/metrics/)** - Metrics collection patterns

### 🔬 [primitives/](src/primitives/)
Low-level SDK primitives for direct usage.
- Basic embedder (text embeddings)
- Basic NER (named entity recognition)
- Basic VAD (voice activity detection)
- Basic Jinja templates

### 🛠️ [utilities/](src/utilities/)
Utility nodes and helpers for advanced graph patterns.
- Proxy node for graph composition
- Helper utilities

### 🔧 [shared/](src/shared/)
Shared utilities and helpers used across templates.
- CLI helpers
- Shared constants
- Shared prompt templates

### 🚀 [voice_agent/](voice_agent/)
A complete full-stack voice agent application with Node server and React client.

## 📋 Prerequisites

- **Node.js 18+** (check with `node -v`)
- **Yarn** (recommended) or npm
- **Inworld API key** - Set as environment variable:
  ```bash
  export INWORLD_API_KEY="your_key_here"
  ```

## 🏃 Quick Start

### Running Examples

```bash
# 1. Install dependencies
yarn install

# 2. Run any example
yarn node-llm-chat "Tell me about AI"
yarn node-intent "What house are you in?"
yarn node-stt path/to/audio.wav
```

## 📚 Example Commands

### Conversational AI

```bash
# LLM chat with tools and streaming
yarn node-llm-chat "Tell me the weather in Vancouver and evaluate 2 + 2" \
  --provider=openai --modelName=gpt-4o-mini --tools --toolChoice=auto

# Speech to text
yarn node-stt path/to/audio.wav

# Text to speech
yarn node-tts "Hello world" --output=output.wav

# Long-term memory
yarn long-term-memory
```

### Knowledge & RAG

```bash
# Intent matching
yarn node-intent "What house are you in?"

# Knowledge retrieval
yarn node-knowledge "Tell me about Hogwarts"

# Intent routing
yarn conditional-edges-after-intent
```

### Safety

```bash
# Keyword matching
yarn node-keyword-matcher "Check this text for issues"

# Text classification
yarn node-text-classifier "Analyze this content"

# Safety pipeline
yarn safety-subgraph "Run full safety checks"
```

### Tools & MCP

```bash
# List MCP tools
yarn node-mcp-list-tools

# Call MCP tool
yarn node-mcp-call-tool --tool=calculator --args='{"expression": "2+2"}'

# MCP subgraph
yarn node-mcp-subgraph
```

### Routing

```bash
# LLM output routing
yarn conditional-edges-after-llm "Route this message"

# Function-based routing
yarn custom-conditional-edges-after-llm "Use function calling"

# Model selection
yarn model-selector-conditional
```

### Streaming

```bash
# LLM streaming
yarn node-custom-llm-stream "Stream this response"

# Streaming with abort control
yarn node-custom-llm-stream-with-abort-controller

# Text stream processing
yarn simple-reverse-stream "Reverse this text"
```

### Text Processing

```bash
# Text chunking
yarn node-text-chunking-and-aggregator "Long text to chunk..."

# Template rendering
yarn node-custom-jinja --template=path/to/template.jinja

# Custom transformations
yarn node-custom-advanced
```

### Primitives

```bash
# Text embeddings
yarn basic-embedder

# Named entity recognition
yarn basic-ner

# Voice activity detection
yarn basic-vad path/to/audio.wav

# Jinja template rendering
yarn basic-jinja-template
```

## 🎯 Learning Path

### New to Inworld Runtime?
1. Start with basic LLM examples in [llm/](src/llm/)
2. Try voice processing in [voice/](src/voice/)
3. Explore streaming patterns in [streaming/](src/streaming/)

### Building a Chatbot?
1. [llm/llm_chat.ts](src/llm/llm_chat.ts) - Basic LLM chat
2. [llm/tools/mcp_call_tool.ts](src/llm/tools/mcp_call_tool.ts) - Add function calling
3. [llm/routing/llm_output_routing.ts](src/llm/routing/llm_output_routing.ts) - Add routing logic
4. [safety/safety_pipeline.ts](src/safety/safety_pipeline.ts) - Add content moderation

### Building a Voice Agent?
1. [voice/speech_to_text.ts](src/voice/speech_to_text.ts) - STT
2. [voice/text_to_speech.ts](src/voice/text_to_speech.ts) - TTS
3. [voice_agent/README.md](voice_agent/README.md) - Full application

### Adding RAG?
1. [retrieval/knowledge_retrieval.ts](src/retrieval/knowledge_retrieval.ts) - Basic RAG
2. [retrieval/intent_matching.ts](src/retrieval/intent_matching.ts) - Intent matching
3. [retrieval/knowledge_routing.ts](src/retrieval/knowledge_routing.ts) - Route based on context

### Working with Primitives?
Low-level SDK components for direct usage:
1. [primitives/basic_embedder.ts](src/primitives/basic_embedder.ts) - Generate text embeddings
2. [primitives/basic_ner.ts](src/primitives/basic_ner.ts) - Extract named entities
3. [primitives/basic_vad.ts](src/primitives/basic_vad.ts) - Detect voice activity
4. [primitives/basic_jinja_template.ts](src/primitives/basic_jinja_template.ts) - Render templates

## 📖 Available Scripts

All script names are listed in [package.json](package.json). Each script corresponds to a template file:

- `yarn <script-name> <args>` - Run any template
- See each domain folder's README for specific examples

## 🐛 Troubleshooting

### Missing API Key
```bash
export INWORLD_API_KEY="your_key_here"
# Or create a .env file in templates/ts/
```

### Port Conflicts
The voice agent client will automatically pick the next available port if 3000 is taken.

### Audio Issues
Grant microphone permissions in your browser for voice agent examples.

### Module Not Found
Make sure you've run `yarn install` in the templates/ts directory.

### Voice Agent Setup
See [voice_agent/README.md](voice_agent/README.md) for complete setup instructions.

## 📝 Template Structure

```
templates/ts/
├── src/                    # All template source files
│   ├── llm/                # LLM operations, routing, tools
│   │   ├── llm_chat.ts     # Basic LLM chat
│   │   ├── llm_completion.ts  # LLM completion
│   │   ├── llm_with_components.ts  # Components example
│   │   ├── llm_component_registry.ts  # Registry patterns
│   │   ├── random_canned_responses.ts  # Canned responses
│   │   ├── routing/        # Conditional logic & model selection
│   │   └── tools/          # Function calling & MCP
│   ├── voice/              # Voice processing (STT, TTS)
│   │   ├── speech_to_text.ts  # STT
│   │   ├── text_to_speech.ts  # TTS
│   │   ├── tts_streaming.ts   # Streaming TTS
│   │   └── tts_with_components.ts  # TTS with components
│   ├── advanced/           # Advanced examples & patterns
│   │   └── character_generator.ts  # Character generation
│   ├── retrieval/          # RAG, search, memory, intent
│   │   ├── knowledge_retrieval.ts  # Basic RAG
│   │   ├── intent_matching.ts  # Intent matching
│   │   ├── knowledge_routing.ts  # Knowledge routing
│   │   ├── intent_routing.ts  # Intent routing
│   │   └── long_term_memory.ts  # LTM integration
│   ├── safety/             # Content moderation
│   │   ├── text_classifier.ts  # Text classification
│   │   ├── keyword_matcher.ts  # Keyword matching
│   │   └── safety_pipeline.ts  # Safety pipeline
│   ├── streaming/          # Real-time processing
│   │   ├── llm_streaming.ts   # LLM streaming
│   │   ├── llm_streaming_abort.ts  # Streaming with abort
│   │   ├── text_reverse_stream.ts  # Text stream example
│   │   └── audio_join_stream.ts  # Audio streaming
│   ├── text_processing/    # Text transforms
│   │   ├── text_chunking.ts   # Text chunking
│   │   ├── template_rendering.ts  # Jinja templates
│   │   └── advanced_text_transform.ts  # Advanced transforms
│   ├── observability/      # Telemetry & metrics
│   │   └── telemetry_capabilities.ts  # Basic telemetry
│   ├── primitives/         # Low-level SDK primitives
│   │   ├── basic_embedder.ts  # Text embeddings
│   │   ├── basic_ner.ts    # Named entity recognition
│   │   ├── basic_vad.ts    # Voice activity detection
│   │   └── basic_jinja_template.ts  # Template rendering
│   ├── utilities/          # Utility nodes & helpers
│   │   └── proxy_node.ts   # Proxy node for graph composition
│   └── shared/             # Shared utilities & helpers
│       ├── constants.ts    # Shared constants
│       ├── helpers/        # CLI utilities
│       ├── prompts/        # Shared prompt templates
│       └── models/         # Shared model assets
├── voice_agent/            # Complete voice agent application
├── package.json            # Scripts and dependencies
└── README.md               # This file
```

## 💡 Tips

1. **Start Simple**: Begin with basic examples (LLM chat, voice) before diving into complex patterns
2. **Check READMEs**: Each domain folder has a detailed README with examples
3. **Mix and Match**: Combine patterns from different domains
4. **Use Available Scripts**: All scripts are listed in [package.json](package.json)

## 🤝 Contributing

Found a bug or want to add a template? Open an issue or PR, and we will review it.

---

**Happy building!** 🚀

For questions or support, visit [inworld.ai](https://www.inworld.ai)
