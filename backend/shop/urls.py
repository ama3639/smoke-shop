from django.urls import path
from . import views
from .operations import operations
from .suppliers import supplier

urlpatterns = [
    path('supply-requests/', views.supply_request),
    path('site/', views.site_settings),
    path('supplier/', supplier),
    path('operations/', operations),
    path('account/', views.account),
    path('vendors/', views.vendors),
    path('health/', views.health), path('session/', views.session), path('catalog/', views.catalog), path('branches/', views.branches),
    path('catalog/products/', views.products), path('catalog/products/<slug:slug>/', views.product),
    path('cart/', views.cart), path('orders/', views.order_create), path('orders/<uuid:pk>/', views.order_detail),
]

