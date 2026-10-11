from rest_framework import serializers
from .models import Product
from .services import can_purchase, can_purchase_offer


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source='category.slug')
    category_title = serializers.CharField(source='category.title')
    purchasable = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    compatibility = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    offers = serializers.SerializerMethodField()
    retail_available = serializers.SerializerMethodField()
    wholesale_available = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'title', 'slug', 'sku', 'category', 'category_title', 'description', 'material',
                  'dimensions', 'illustration', 'image', 'price', 'stock', 'legal_status', 'purchasable', 'compatibility', 'updated_at',
                  'product_type', 'brand', 'sticks_per_pack', 'packs_per_carton', 'retail_available', 'wholesale_available',
                  'flavor', 'weight_grams', 'manufacturer', 'source_url', 'source_checked_on', 'specification_notes', 'offers']

    def public_offers(self, obj):
        return [offer for offer in obj.offers.all() if offer.active and offer.approved and offer.vendor.active]

    def purchase_allowed(self, obj):
        return can_purchase(obj, self.context.get('cart_enabled'))

    def get_purchasable(self, obj):
        if obj.offers.all():
            return any(can_purchase_offer(o, self.context.get('cart_enabled')) for o in self.public_offers(obj))
        return self.purchase_allowed(obj) and obj.price > 0

    def get_image(self, obj):
        return obj.image.url if obj.image else obj.catalog_image or None

    def get_price(self, obj):
        if not self.purchase_allowed(obj):
            return None
        if obj.offers.all():
            prices = [o.price for o in self.public_offers(obj) if o.price > 0]
            return min(prices) if prices else None
        return obj.price

    def get_stock(self, obj):
        return sum(o.stock for o in self.public_offers(obj)) if obj.offers.all() else obj.stock

    def get_retail_available(self, obj):
        return any(o.retail_available for o in self.public_offers(obj)) if obj.offers.all() else obj.retail_available

    def get_wholesale_available(self, obj):
        return any(o.wholesale_available for o in self.public_offers(obj)) if obj.offers.all() else obj.wholesale_available

    def get_offers(self, obj):
        return [{'id': o.pk, 'vendor': o.vendor.title, 'vendor_slug': o.vendor.slug,
                 'city': o.vendor.city, 'phone': o.vendor.phone, 'stock': o.stock,
                 'price': o.price if self.purchase_allowed(obj) and o.price > 0 else None,
                 'purchasable': can_purchase_offer(o, self.context.get('cart_enabled')),
                 'retail_available': o.retail_available, 'wholesale_available': o.wholesale_available,
                 'updated_at': o.updated_at.isoformat()} for o in self.public_offers(obj)]

    def get_compatibility(self, obj):
        return [{'model': rule.device.title, 'confidence': rule.confidence, 'source': rule.evidence_source,
                 'verified': rule.last_verified.isoformat(), 'incompatible': rule.is_incompatible}
                for rule in obj.compatibility.all()]

