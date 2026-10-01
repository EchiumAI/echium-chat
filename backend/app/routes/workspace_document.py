"""Workspace documents (Files) and folders.

All routes are ``/workspaces/{workspace}/...`` where ``workspace`` is
``default`` (the caller's personal workspace) or a team id / ``WS#TEAM#{id}``.
Team access is enforced in ``usecases.workspace_scope.resolve_workspace``.
"""

from app.routes.schemas.workspace_document import (
    DocumentContentInput,
    DocumentContentOutput,
    DocumentCreateInput,
    DocumentFolderCreateInput,
    DocumentFolderModifyInput,
    DocumentFolderOutput,
    DocumentModifyInput,
    DocumentOutput,
    DocumentRevisionContentOutput,
    DocumentRevisionOutput,
    PresignedUploadInput,
    PresignedUploadOutput,
)
from app.usecases.workspace_document import (
    create_document,
    create_document_folder,
    create_presigned_upload,
    delete_document,
    delete_document_folder,
    get_document_content,
    get_document_revision_content,
    list_document_folders,
    list_document_revisions,
    list_documents,
    modify_document,
    modify_document_folder,
    restore_document_revision,
    update_document_content,
)
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["workspace_document"])


# --- Documents ------------------------------------------------------------ #


@router.post(
    "/workspaces/{workspace}/documents/presigned-url",
    response_model=PresignedUploadOutput,
)
def post_presigned_upload(
    request: Request, workspace: str, upload_input: PresignedUploadInput
):
    """Get a presigned PUT URL to upload a document's raw file to S3."""
    current_user: User = request.state.current_user
    return create_presigned_upload(current_user.id, upload_input, workspace)


@router.post("/workspaces/{workspace}/documents", response_model=DocumentOutput)
def post_document(request: Request, workspace: str, doc_input: DocumentCreateInput):
    """Finalize a document after its file was uploaded via the presigned URL."""
    current_user: User = request.state.current_user
    return create_document(current_user.id, doc_input, workspace)


@router.get("/workspaces/{workspace}/documents", response_model=list[DocumentOutput])
def get_documents(request: Request, workspace: str):
    current_user: User = request.state.current_user
    return list_documents(current_user.id, workspace)


@router.get(
    "/workspaces/{workspace}/documents/{doc_id}/content",
    response_model=DocumentContentOutput,
)
def get_single_document_content(request: Request, workspace: str, doc_id: str):
    """Return a document's text and/or a presigned download URL."""
    current_user: User = request.state.current_user
    return get_document_content(current_user.id, doc_id, workspace)


@router.put(
    "/workspaces/{workspace}/documents/{doc_id}/content",
    response_model=DocumentOutput,
)
def put_single_document_content(
    request: Request, workspace: str, doc_id: str, content_input: DocumentContentInput
):
    """Save (overwrite) a document's canonical text body (editor write-back)."""
    current_user: User = request.state.current_user
    return update_document_content(
        current_user.id,
        doc_id,
        content_input.text,
        content_input.content_type,
        workspace,
    )


@router.get(
    "/workspaces/{workspace}/documents/{doc_id}/revisions",
    response_model=list[DocumentRevisionOutput],
)
def get_document_revisions(request: Request, workspace: str, doc_id: str):
    """Version history: who saved each checkpoint and when (newest first)."""
    current_user: User = request.state.current_user
    return list_document_revisions(current_user.id, doc_id, workspace)


@router.get(
    "/workspaces/{workspace}/documents/{doc_id}/revisions/{revision_id}",
    response_model=DocumentRevisionContentOutput,
)
def get_document_revision(
    request: Request, workspace: str, doc_id: str, revision_id: str
):
    current_user: User = request.state.current_user
    return get_document_revision_content(
        current_user.id, doc_id, revision_id, workspace
    )


@router.post(
    "/workspaces/{workspace}/documents/{doc_id}/revisions/{revision_id}/restore",
    response_model=DocumentOutput,
)
def post_restore_document_revision(
    request: Request, workspace: str, doc_id: str, revision_id: str
):
    current_user: User = request.state.current_user
    return restore_document_revision(current_user.id, doc_id, revision_id, workspace)


@router.patch(
    "/workspaces/{workspace}/documents/{doc_id}", response_model=DocumentOutput
)
def patch_document(
    request: Request, workspace: str, doc_id: str, doc_input: DocumentModifyInput
):
    """Rename / move / favorite / share (update allowed agents)."""
    current_user: User = request.state.current_user
    return modify_document(current_user.id, doc_id, doc_input, workspace)


@router.delete("/workspaces/{workspace}/documents/{doc_id}")
def delete_single_document(request: Request, workspace: str, doc_id: str):
    current_user: User = request.state.current_user
    delete_document(current_user.id, doc_id, workspace)
    return {"status": "ok"}


# --- Folders -------------------------------------------------------------- #


@router.get(
    "/workspaces/{workspace}/document-folders",
    response_model=list[DocumentFolderOutput],
)
def get_document_folders(request: Request, workspace: str):
    current_user: User = request.state.current_user
    return list_document_folders(current_user.id, workspace)


@router.post(
    "/workspaces/{workspace}/document-folders", response_model=DocumentFolderOutput
)
def post_document_folder(
    request: Request, workspace: str, folder_input: DocumentFolderCreateInput
):
    current_user: User = request.state.current_user
    return create_document_folder(current_user.id, folder_input, workspace)


@router.patch(
    "/workspaces/{workspace}/document-folders/{folder_id}",
    response_model=DocumentFolderOutput,
)
def patch_document_folder(
    request: Request,
    workspace: str,
    folder_id: str,
    folder_input: DocumentFolderModifyInput,
):
    current_user: User = request.state.current_user
    return modify_document_folder(current_user.id, folder_id, folder_input, workspace)


@router.delete("/workspaces/{workspace}/document-folders/{folder_id}")
def delete_single_document_folder(request: Request, workspace: str, folder_id: str):
    """Delete a folder; its documents fall back to the library root."""
    current_user: User = request.state.current_user
    delete_document_folder(current_user.id, folder_id, workspace)
    return {"status": "ok"}
