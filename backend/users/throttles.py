from rest_framework.throttling import SimpleRateThrottle

class LoginRateThrottle(SimpleRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        username = request.data.get("username", "")
        ident = self.get_ident(request) # clients IP
        return self.cache_format % {"scope": self.scope, "ident": f"{ident}:{username}"}
    