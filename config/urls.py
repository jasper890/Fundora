from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView, PasswordChangeView
from django.urls import path, reverse_lazy

from proofpay import views
from proofpay.forms import ProvisionedAuthenticationForm


urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "login/",
        LoginView.as_view(
            template_name="registration/login.html",
            authentication_form=ProvisionedAuthenticationForm,
        ),
        name="login",
    ),
    path("logout/", LogoutView.as_view(), name="logout"),
    path(
        "password-change/",
        PasswordChangeView.as_view(
            template_name="registration/password_change.html",
            success_url=reverse_lazy("program_list"),
        ),
        name="password_change",
    ),
    path("programs/", views.program_list, name="program_list"),
    path("awards/<uuid:award_id>/", views.award_detail, name="award_detail"),
    path("awards/<uuid:award_id>/prepare/payout/", views.prepare_payout, name="prepare_payout"),
]
