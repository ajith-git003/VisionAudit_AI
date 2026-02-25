import os
import logging
from dotenv import load_dotenv
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.vectorstores import AzureSearch

load_dotenv(override=True)

def test_search(query):
    embeddings = AzureOpenAIEmbeddings(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME", "text-embedding-3-small"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY")
    )

    vector_store = AzureSearch(
        azure_search_endpoint=os.getenv("AZURE_AI_SEARCH_ENDPOINT"),
        azure_search_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME"),
        embedding_function=embeddings.embed_query,
    )

    print(f"\nSearching for: '{query}'")
    docs = vector_store.hybrid_search(query, k=5)
    if not docs:
        print("No rules found.")
    for i, doc in enumerate(docs):
        print(f"\n--- Result {i+1} (Source: {doc.metadata.get('source')}) ---")
        print(doc.page_content[:500] + "...")

if __name__ == "__main__":
    test_search("betting gambling")
    test_search("health medical clinical")
    test_search("disclosure sponsored paid")
