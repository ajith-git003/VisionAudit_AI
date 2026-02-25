import os 
import glob
import logging
from dotenv import load_dotenv
load_dotenv(override=True)

#document loaders and splitters
from langchain.document_loaders import pyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

#azure components import
from langchain_openai import AzureOpenAIEmbeddings
from langchain_community.vectorstores import AzureSearch

#setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("indexer")

def index_doc():
    '''
    Read the PDFs, chunks them, and upload them to Azure AI Search
    '''

    #define paths, we look for data folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_folder = os.path.join(current_dir, "../../backend/data")

    #check the environment variables 
    logger.info("="*60)
    logger.info("Environment Configuration Check:")
    logger.info(f"AZURE_OPENAI_ENDPOINT: {os.getenv('AZURE_OPENAI_ENDPOINT')}")
    logger.info(f"AZURE_OPENAI_API_VERSION : {os.getenv('AZURE_OPENAI_API_VERSION')}")
    logger.info(f"Embedding Deployment : {os.getenv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-small')}")
    logger.info(f"AZURE_SEARCH_ENDPOINT : {os.getenv('AZURE_SEARCH_ENDPOINT')}")
    logger.info(f"AZURE_SEARCH_INDEX_NAME : {os.getenv('AZURE_SEARCH_INDEX_NAME')}")
    logger.info("="*60)

    #validate the required environment variables
    required_env_vars = [
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_KEY",
        "AZURE_SEARCH_ENDPOINT",
        "AZURE_SEARCH_API_KEY",
        "AZURE_SEARCH_INDEX_NAME"
    ]

    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set the missing environment variables and try again.")
        return
    
    #initialize the embedding model: turns text into vectors
    try:
        logger.info("Initializing Azure OpenAI Embeddings...")
        embeddings = AzureOpenAIEmbeddings(
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT"),
            azure_deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small"),
            openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
            openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        )
        logger.info("Azure OpenAI Embeddings initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Azure OpenAI Embeddings: {e}")
        logger.error("Please check your Azure OpenAI deployment name and endpoint")
        return
    
    #intialise the Azure Search
    try:
        logger.info("Initializing Azure AI Search Vector Store...")
        embeddings = AzureOpenAIEmbeddings(
            azure_search_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT"),
            azure_search_api_key = os.getenv("AZURE_SEARCH_API_KEY"),
            index_name = os.getenv("AZURE_SEARCH_INDEX_NAME"),
            embedding_function = embeddings.embed_query
        )
        logger.info(f"Azure Search Vector Store initialized successfully.: {index_name}")
    except Exception as e:
        logger.error(f"Failed to initialize Azure Search Vector Store: {e}")
        logger.error("Please check your Azure Search endpoint, API key, and index name")
        return
    
    #Find PDF files in the data folder
    pdf_files = glob.glob(os.path.join(data_folder, "*.pdf"))
    if not pdf_files:
        logger.warning(f"No PDF files found in {data_folder}. Please add PDF documents to index.")
    logger.info(f"Found {len(pdf_files)} PDFs files to process: {[os.path.basename(f) for f in pdf_files]}")

    all_splits = []

    #process each PDF
    for pdf_file in pdf_files:
        try:
            logger.info(f"Processing file: {os.path.basename(pdf_file)}...")
            #load the PDF
            loader = pyPDFLoader(pdf_file)
            raw_docs = loader.load()
            

            #split the text into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, 
                chunk_overlap=200
                )
            splits = text_splitter.split_documents(raw_docs)
            for split in splits:
                split.metadata["source"] = os.path.basename(pdf_file)

            all_splits.extend(splits)
            logger.info(f"Split into {len(splits)} Chunks.")
           
            
        except Exception as e:
            logger.error(f"Failed to process {pdf_file}: {e}")


        #upload the chunks to Azure Search
        if all_splits:
            logger.info(f"Uploading {len(all_splits)} chunks to Azure Search Index '{index_name}'")
            try:
                #azure search accepts batches automatically via this method
                vector_store.add_documents(documents = all_splits)
                logger.info("="*60)
                logger.info("Indexing Complete! Knowledge base is ready for retrieval.")
                logger.info(f"Total Documents Indexed: {len(all_splits)}")
                logger.info("="*60)
            except Exception as e:
                logger.error(f"Failed to upload documents to Azure Search: {e}")
                logger.error("Please check your Azure Search configuration and try again.")

        else:
            logger.warning("No document chunks to upload to Azure Search. Skipping indexing step.")
if __name__ == "__main__":
    index_doc()