"""Request-path hygiene.

CollapseSlashesMiddleware: some shipped frontend builds constructed API
URLs with a double slash (``/api//farmers/``), which Django's resolver
correctly 404s. Normalising repeated slashes in path_info before routing
heals every client — including older cached app builds still open in a
browser — without redirects (which would break POST bodies).
"""
import re


class CollapseSlashesMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if "//" in request.path_info:
            request.path_info = re.sub(r"/{2,}", "/", request.path_info)
        return self.get_response(request)
