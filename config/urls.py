from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView, PasswordChangeView
from django.urls import path, reverse_lazy

from proofpay import views, chain_views
from proofpay.forms import ProvisionedAuthenticationForm


urlpatterns = [
    path("wallet-check/", views.wallet_check, name="wallet_check"),
    path("programs/<uuid:program_id>/", views.program_detail, name="program_detail"),
    path("programs/<uuid:program_id>/export/", views.program_export, name="program_export"),
    path("awards/<uuid:award_id>/audit/", views.award_audit, name="award_audit"),
    path(
        "awards/<uuid:award_id>/prepare/<str:action>/",
        chain_views.prepare,
        name="prepare_action",
    ),
    path(
        "operations/<uuid:operation_id>/submit/",
        chain_views.submit,
        name="submit_operation",
    ),
    path(
        "operations/<uuid:operation_id>/", chain_views.status, name="operation_status"
    ),
    path(
        "operations/<uuid:operation_id>/abandon/",
        chain_views.abandon,
        name="abandon_operation",
    ),
    path(
        "awards/<uuid:award_id>/evidence/",
        views.evidence_upload,
        name="evidence_upload",
    ),
    path(
        "evidence/<uuid:evidence_id>/download/",
        views.evidence_download,
        name="evidence_download",
    ),
    path("awards/<uuid:award_id>/review/", views.review_request, name="review_request"),
    path(
        "awards/<uuid:award_id>/request-changes/",
        views.review_request,
        {"action": "REQUEST_CHANGES"},
        name="request_changes",
    ),
    path(
        "awards/<uuid:award_id>/disputes/",
        views.review_request,
        {"action": "DISPUTE"},
        name="disputes",
    ),
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
    path(
        "awards/<uuid:award_id>/prepare/payout/",
        chain_views.prepare,
        {"action": "PAY"},
        name="prepare_payout",
    ),
]
