from django.urls import path
from . import views
from .operations import operations

urlpatterns = [
    path('operations/', operations),
    path('account/', views.account),
    path('vendors/', views.vendors),
    path('health/', views.health), path('session/', views.session), path('catalog/', views.catalog), path('branches/', views.branches),
    path('catalog/products/', views.products), path('catalog/products/<slug:slug>/', views.product),
    path('cart/', views.cart), path('orders/', views.order_create), path('orders/<uuid:pk>/', views.order_detail),
]

