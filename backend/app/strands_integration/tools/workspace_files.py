"""Strands tools: let an agent list and read the files shared with it.

Workspace knowledge is also injected into the system prompt, but only a short
excerpt per document (to bound cost). For anything longer, such as a PDF of
fund holdings, the agent needs to read the whole file. These tools give it that
access, limited to the documents shared with this agent (same visibility rules
as injection), across the user's personal workspace and their teams.
"""

import logging

from strands import tool

logger = logging.getLogger(__name__)

# One page of text per read call; the agent can ask for the next page.
PAGE_CHARS = 30_000


def create_workspace_file_tools(user_id: str, agent_id: str):
    """Build `list_shared_files` and `read_shared_file` bound to this agent."""
    from app.usecases.workspace_document import ensure_document_text
    from app.usecases.workspace_retrieval import visible_documents_with_owner

    def _shared():
        return [
            (owner, d)
            for owner, d in visible_documents_with_owner(user_id, agent_id)
            if d.source != "chat_summary"
        ]

    @tool
    def list_shared_files() -> dict:
        """List the files (PDF, Word, Excel, CSV, text, documents) that the user
        has shared with you. Call this when the user refers to files, documents,
        attachments or uploads, then use read_shared_file to read them. You CAN
        read these files, including PDFs; never say you cannot access them.
        """
        try:
            files = _shared()
            if not files:
                text = (
                    "No files are shared with you yet. The user can share files "
                    "from Files > Share with agents."
                )
            else:
                lines = [
                    f"- {d.filename} (id: {d.id}, {d.size} bytes)" for _, d in files
                ]
                text = "Files shared with you:\n" + "\n".join(lines)
            return {"status": "success", "content": [{"text": text}]}
        except Exception as e:
            logger.exception("[LIST_SHARED_FILES] failed")
            return {"status": "error", "content": [{"text": f"Failed: {e}"}]}

    @tool
    def read_shared_file(name_or_id: str, page: int = 1) -> dict:
        """Read the full text of a file shared with you (PDF, Word, Excel, CSV,
        text or a document).

        Args:
            name_or_id: The file name (or part of it) or its id, as returned by
                list_shared_files.
            page: Page of text to read, starting at 1. Long files are split into
                pages; the result says if more pages exist.
        """
        try:
            files = _shared()
            key = name_or_id.strip().lower()
            match = next((p for p in files if p[1].id == name_or_id.strip()), None)
            if match is None:
                match = next(
                    (p for p in files if p[1].filename.lower() == key), None
                ) or next((p for p in files if key in p[1].filename.lower()), None)
            if match is None:
                names = ", ".join(d.filename for _, d in files) or "none"
                return {
                    "status": "error",
                    "content": [
                        {
                            "text": f"No shared file matches '{name_or_id}'. Shared files: {names}"
                        }
                    ],
                }
            owner, doc = match
            text = ensure_document_text(owner, doc)
            if not text.strip():
                return {
                    "status": "success",
                    "content": [
                        {
                            "text": (
                                f"'{doc.filename}' contains no extractable text "
                                "(it may be a scanned image or an unsupported "
                                "format). Tell the user it needs a text-based "
                                "version of the file."
                            )
                        }
                    ],
                }
            pages = max(1, -(-len(text) // PAGE_CHARS))
            page = min(max(1, page), pages)
            chunk = text[(page - 1) * PAGE_CHARS : page * PAGE_CHARS]
            more = (
                f"\n\n[Page {page} of {pages}. Call read_shared_file again with "
                f"page={page + 1} for more.]"
                if page < pages
                else f"\n\n[Page {page} of {pages}. End of file.]"
            )
            return {
                "status": "success",
                "content": [{"text": f"# {doc.filename}\n\n{chunk}{more}"}],
            }
        except Exception as e:
            logger.exception("[READ_SHARED_FILE] failed")
            return {"status": "error", "content": [{"text": f"Failed: {e}"}]}

    return [list_shared_files, read_shared_file]
