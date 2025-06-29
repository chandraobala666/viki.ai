# VIKI AI - Agent Platform

## Overview
- VIKI AI, Agent Platform that helps to create multiple Agents.  
- These agents can be connected to a wide range of tools using Anthropic - [MCP](https://modelcontextprotocol.io/introduction), Retrieval Augmented Generation (RAG), and agents to agent orchestration using [Langgraph](https://www.langchain.com/langgraph).

## Tech Stack
- **LLM**
  - [Langchain](https://www.langchain.com/)
- **Agent**
  - [Langgraph](https://www.langchain.com/langgraph)
- **RAG**
  - [Milvus](https://milvus.io/)
- **Database**
  - OracleDB
  - SQLLite v3
- **Programming Language**
  - Python
  - Java

## Feature
- **LLM Configuration**
  - Supports below providers
    - [OpenRouter](https://openrouter.ai/)
    - [Huggingface](https://huggingface.co/blog/inference-pro#supported-models)
    - [OpenAI](https://platform.openai.com/)
    - [Anthropic](https://console.anthropic.com/)
    - [Groq](https://console.groq.com/docs/tool-use)
    - [Ollama](https://ollama.com/)
    - [Azure](https://github.com/marketplace/models)
    - [Google](https://console.cloud.google.com/vertex-ai/model-garden)
- **Tools**
  - Configure & Expose MCP as Tools
- **RAG**
  - Provide collection of documents
- **Agents**
  - *Simple Agents:* It supports connecting LLM with Tools and RAG
  - *Multi Agent:* Orchestrate between Agents.
- **Chat**
  - End user interface to Talk to Agent. 

## Notes
- To improve ollama performance on Macbook Pro M4 run `sudo sysctl iogpu.wired_limit_mb=31200` replace 31200 with total ram - 10gb.

## Reference
- [Langchain OAP](https://oap.langchain.com/)
- [Langchain Opencanvas](https://opencanvas.langchain.com/)