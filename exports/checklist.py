"""Export document completeness checklist (Phase 4 P0).

A container may be marked ready (sealed) ONLY when every required document
exists for it: ICO Certificate of Origin, Phytosanitary, ECTA clearance,
Commercial Invoice, Packing List, and the EUDR GeoJSON dossier.
"""
from .models import ContainerLoading, ExportDocument

REQUIRED_DOC_TYPES = [
    ("ico_cert", "ICO Certificate of Origin"),
    ("phytosanitary", "Phytosanitary Certificate"),
    ("ecta", "ECTA Clearance"),
    ("commercial_invoice", "Commercial Invoice"),
    ("packing_list", "Packing List"),
    ("eudr_dossier", "EUDR GeoJSON Dossier"),
]


def document_checklist(container: ContainerLoading) -> dict:
    present = set(ExportDocument.objects.filter(container=container)
                  .values_list("doc_type", flat=True))
    items = [{"doc_type": code, "label": label, "present": code in present}
             for code, label in REQUIRED_DOC_TYPES]
    missing = [i["label"] for i in items if not i["present"]]
    return {"container": container.container_number, "items": items,
            "missing": missing, "complete": not missing,
            "status": container.status}


class ChecklistError(Exception):
    pass


def mark_container_ready(container: ContainerLoading) -> ContainerLoading:
    result = document_checklist(container)
    if not result["complete"]:
        raise ChecklistError(
            "Container cannot be marked ready — missing export documents: "
            + ", ".join(result["missing"]))
    if container.status != ContainerLoading.Status.LOADING:
        raise ChecklistError(f"Container is {container.status}, not loading.")
    if not container.seal_number:
        raise ChecklistError("Container has no seal number recorded.")
    if container.total_bags <= 0 or container.total_net_kg <= 0:
        raise ChecklistError("Container has no bags/weight loaded.")
    container.status = ContainerLoading.Status.SEALED
    container.save(update_fields=["status", "updated_at"])
    return container
