from app.routes.schemas.workspace_document import (
    DocumentCreateInput,
    DocumentFolderCreateInput,
    DocumentFolderModifyInput,
    DocumentFolderOutput,
    DocumentModifyInput,
    DocumentOutput,
    PresignedUploadInput,
    PresignedUploadOutput,
)
from app.usecases.workspace_document import (
    create_document,
    create_document_folder,
    create_presigned_upload,
    delete_document,
    delete_document_folder,
    list_document_folders,
    list_documents,
    modify_document,
    modify_document_folder,
)
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["workspace_document"])


# --- Documents ------------------------------------------------------------ #


@router.post(
    "/workspaces/default/documents/presigned-url",
    response_model=PresignedUploadOutput,
)
def post_presigned_upload(request: Request, upload_input: PresignedUploadInput):
    """Get a presigned PUT URL to upload a document's raw file to S3."""
    current_user: User = request.state.current_user
    return create_presigned_upload(current_user.id, upload_input)


@router.post("/workspaces/default/documents", response_model=DocumentOutput)
def post_document(request: Request, doc_input: DocumentCreateInput):
    """Finalize a document after its file was uploaded via the presigned URL."""
    current_user: User = request.state.current_user
    return create_document(current_user.id, doc_input)


@router.get("/workspaces/default/documents", response_model=list[DocumentOutput])
def get_documents(request: Request):
    current_user: User = request.state.current_user
    return list_documents(current_user.id)


@router.patch("/workspaces/default/documents/{doc_id}", response_model=DocumentOutput)
def patch_document(request: Request, doc_id: str, doc_input: DocumentModifyInput):
    """Rename / move / share (update allowed agents)."""
    current_user: User = request.state.current_user
    return modify_document(current_user.id, doc_id, doc_input)


@router.delete("/workspaces/default/documents/{doc_id}")
def delete_single_document(request: Request, doc_id: str):
    current_user: User = request.state.current_user
    delete_document(current_user.id, doc_id)
    return {"status": "ok"}


# --- Folders -------------------------------------------------------------- #


@router.get(
    "/workspaces/default/document-folders",
    response_model=list[DocumentFolderOutput],
)
def get_document_folders(request: Request):
    current_user: User = request.state.current_user
    return list_document_folders(current_user.id)


@router.post(
    "/workspaces/default/document-folders", response_model=DocumentFolderOutput
)
def post_document_folder(request: Request, folder_input: DocumentFolderCreateInput):
    current_user: User = request.state.current_user
    return create_document_folder(current_user.id, folder_input)


@router.patch(
    "/workspaces/default/document-folders/{folder_id}",
    response_model=DocumentFolderOutput,
)
def patch_document_folder(
    request: Request, folder_id: str, folder_input: DocumentFolderModifyInput
):
    current_user: User = request.state.current_user
    return modify_document_folder(current_user.id, folder_id, folder_input)


@router.delete("/workspaces/default/document-folders/{folder_id}")
def delete_single_document_folder(request: Request, folder_id: str):
    """Delete a folder; its documents fall back to the library root."""
    current_user: User = request.state.current_user
    delete_document_folder(current_user.id, folder_id)
    return {"status": "ok"}
