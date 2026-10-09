from rest_framework import serializers
from .models import Product
from .services import can_purchase


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source='category.slug')
    category_title = serializers.CharField(source='category.title')
    purchasable = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    compatibility = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'title', 'slug', 'sku', 'category', 'category_title', 'description', 'material',
                  'dimensions', 'illustration', 'image', 'price', 'stock', 'legal_status', 'purchasable', 'compatibility', 'updated_at']

    def get_purchasable(self, obj):
        return can_purchase(obj) and obj.price > 0

    def get_price(self, obj):
        return obj.price if can_purchase(obj) else None

    def get_compatibility(self, obj):
        return [{'model': rule.device.title, 'confidence': rule.confidence, 'source': rule.evidence_source,
                 'verified': rule.last_verified.isoformat(), 'incompatible': rule.is_incompatible}
                for rule in obj.compatibility.all()]
