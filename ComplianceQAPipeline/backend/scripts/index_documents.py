import os
import glob
import logging
from dotenv import load_dotenv
load_dotenv(override=True)

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.vectorstores import AzureSearch

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("indexer")

def index_doc():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_folder = os.path.join(current_dir, "../data")

    logger.info("=" * 60)
    logger.info(f"AZURE_OPENAI_ENDPOINT:   {os.getenv('AZURE_OPENAI_ENDPOINT')}")
    logger.info(f"AZURE_AI_SEARCH_ENDPOINT: {os.getenv('AZURE_AI_SEARCH_ENDPOINT')}")
    logger.info(f"AZURE_SEARCH_INDEX_NAME:  {os.getenv('AZURE_SEARCH_INDEX_NAME')}")
    logger.info("=" * 60)

    required = [
        "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_VERSION",
        "AZURE_AI_SEARCH_ENDPOINT", "AZURE_SEARCH_API_KEY", "AZURE_SEARCH_INDEX_NAME"
    ]
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        logger.error(f"Missing env vars: {', '.join(missing)}")
        return

    embeddings = AzureOpenAIEmbeddings(
        azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    )

    index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")
    vector_store = AzureSearch(
        azure_search_endpoint=os.getenv("AZURE_AI_SEARCH_ENDPOINT"),
        azure_search_key=os.getenv("AZURE_SEARCH_API_KEY"),
        index_name=index_name,
        embedding_function=embeddings.embed_query,
    )
    logger.info(f"Connected to Azure Search index: {index_name}")

    pdf_files = glob.glob(os.path.join(data_folder, "*.pdf"))
    if not pdf_files:
        logger.error(f"No PDF files found in {data_folder}. Add your compliance PDFs there.")
        return
    logger.info(f"Found {len(pdf_files)} PDFs: {[os.path.basename(f) for f in pdf_files]}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    all_splits = []

    for pdf_file in pdf_files:
        try:
            logger.info(f"Processing: {os.path.basename(pdf_file)}")
            docs = PyPDFLoader(pdf_file).load()
            splits = splitter.split_documents(docs)
            for s in splits:
                s.metadata["source"] = os.path.basename(pdf_file)
            all_splits.extend(splits)
            logger.info(f"  → {len(splits)} chunks")
        except Exception as e:
            logger.error(f"Failed to process {pdf_file}: {e}")

    if not all_splits:
        logger.warning("No chunks to upload.")
        return

    logger.info(f"Uploading {len(all_splits)} chunks to Azure Search...")
    vector_store.add_documents(documents=all_splits)
    logger.info("=" * 60)
    logger.info(f"Done! {len(all_splits)} chunks indexed into '{index_name}'")
    logger.info("=" * 60)

if __name__ == "__main__":
    index_doc()
