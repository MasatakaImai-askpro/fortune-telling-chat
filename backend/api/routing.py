from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/chat/fortuneteller/(?P<fortuneteller_id>\d+)/$", consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/chat/(?P<room_id>[0-9a-fA-F]+)/$", consumers.ChatConsumer.as_asgi()),
]