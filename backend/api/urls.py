from django.urls import path
from .views import (
    HelloView,
    QuerentKarteView,
    QuerentRegistrationView,
    FortunetellerRegistrationView,
    UserLogin,
    GETFortuneTeller,
    FortunetellerInfo,
    FortunetellerBankInfo,
    chatRoomInfo
)

urlpatterns = [
    path("users/", HelloView.as_view()),
    path("user_login/", UserLogin.as_view()),
    path("create_querent_user/", QuerentRegistrationView.as_view()),
    path("create_fortune_user/", FortunetellerRegistrationView.as_view()),
    path("get_fortuneteller_all/", GETFortuneTeller.as_view()),
    path("get_fortuneteller_info/", FortunetellerInfo.as_view()),
    path("get_fortuneteller_bank_info/", FortunetellerBankInfo.as_view()),
    path("get_room/",chatRoomInfo.as_view()),
    path("edit_querent_karte/", QuerentKarteView.as_view()),
    path("edit_fortuneteller_pro/", FortunetellerInfo.as_view()),
    path("edit_fortuneteller_bank_info/",FortunetellerBankInfo.as_view()),
]
