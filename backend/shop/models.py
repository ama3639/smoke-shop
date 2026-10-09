import uuid
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q


def normalize(text):
    return text.replace('ي', 'ی').replace('ك', 'ک').replace('\u200c', ' ').lower()


class Category(models.Model):
    title = models.CharField('عنوان', max_length=100)
    slug = models.SlugField(unique=True)
    online_enabled = models.BooleanField('فروش آنلاین دسته فعال است', default=False)

    def __str__(self):
        return self.title


class Product(models.Model):
    class LegalStatus(models.TextChoices):
        APPROVED_ONLINE = 'APPROVED_ONLINE', 'تأیید فروش آنلاین'
        CATALOG_ONLY = 'CATALOG_ONLY', 'فقط کاتالوگ'
        IN_PERSON_ONLY = 'IN_PERSON_ONLY', 'فقط شعب حضوری'
        REVIEW_REQUIRED = 'REVIEW_REQUIRED', 'در انتظار بررسی'
        BLOCKED = 'BLOCKED', 'مسدود'

    title = models.CharField('عنوان', max_length=160)
    slug = models.SlugField(unique=True)
    sku = models.CharField(max_length=50, unique=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    product_type = models.CharField('نوع کالا', max_length=20, choices=[('accessory', 'اکسسوری'), ('cigarette', 'سیگار')], default='accessory')
    brand = models.CharField('برند', max_length=100, blank=True)
    sticks_per_pack = models.PositiveSmallIntegerField('تعداد نخ در بسته', default=20, validators=[MinValueValidator(1), MaxValueValidator(100)])
    packs_per_carton = models.PositiveSmallIntegerField('تعداد بسته در باکس', default=10, validators=[MinValueValidator(1), MaxValueValidator(100)])
    retail_available = models.BooleanField('معرفی عرضه تکی', default=True)
    wholesale_available = models.BooleanField('معرفی عرضه عمده', default=False)
    description = models.TextField('توضیحات')
    material = models.CharField('جنس', max_length=100, blank=True)
    dimensions = models.CharField('ابعاد', max_length=100, blank=True)
    illustration = models.CharField('طرح نمایشی', max_length=20, choices=[('case', 'کیف'), ('brush', 'پاک‌کن'), ('stand', 'پایه'), ('ring', 'واشر'), ('pack', 'بسته سیگار'), ('carton', 'باکس سیگار')], default='case')
    image = models.ImageField('تصویر واقعی کالا', upload_to='products/%Y/%m/', blank=True,
                              validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp'])])
    price = models.PositiveBigIntegerField('قیمت به تومان', default=0)
    stock = models.PositiveIntegerField('موجودی', default=0)
    legal_status = models.CharField('وضعیت حقوقی', max_length=30, choices=LegalStatus.choices, default=LegalStatus.REVIEW_REQUIRED)
    legal_reference = models.CharField('مرجع تأیید حقوقی کتبی', max_length=300, blank=True)
    active = models.BooleanField('نمایش', default=True)
    search_text = models.TextField(editable=False, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        permissions = [('approve_legal_status', 'Can approve legal classification')]
        constraints = [models.CheckConstraint(condition=Q(stock__gte=0), name='product_stock_nonnegative')]

    def clean(self):
        if self.product_type == 'cigarette' and self.legal_status == self.LegalStatus.APPROVED_ONLINE:
            raise ValidationError({'legal_status': 'سیگار فقط به‌صورت کاتالوگ یا معرفی عرضه حضوری قابل ثبت است.'})
        if self.legal_status == self.LegalStatus.APPROVED_ONLINE and not self.legal_reference.strip():
            raise ValidationError({'legal_reference': 'تأیید فروش آنلاین به مرجع کتبی نیاز دارد.'})

    def save(self, *args, **kwargs):
        self.search_text = normalize(f'{self.title} {self.sku} {self.brand} {self.description} {self.material}')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Device(models.Model):
    title = models.CharField('مدل وسیله', max_length=120)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.title


class Branch(models.Model):
    title = models.CharField('نام شعبه', max_length=120)
    city = models.CharField('شهر', max_length=100)
    address = models.TextField('نشانی')
    phone = models.CharField('تلفن', max_length=30)
    hours = models.CharField('ساعات فعالیت', max_length=200)
    active = models.BooleanField('نمایش', default=False)

    def __str__(self):
        return self.title


class CompatibilityRule(models.Model):
    device = models.ForeignKey(Device, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='compatibility')
    confidence = models.CharField(max_length=20, choices=[('CONFIRMED', 'تأییدشده'), ('PROBABLE', 'محتمل'), ('EXPERIMENTAL', 'آزمایشی')], default='CONFIRMED')
    evidence_source = models.CharField('منبع بررسی', max_length=300)
    last_verified = models.DateField('تاریخ بررسی')
    is_incompatible = models.BooleanField('ناسازگار', default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['device', 'product'], name='unique_compatibility')]


class FeatureFlag(models.Model):
    key = models.CharField(max_length=80, unique=True)
    is_enabled = models.BooleanField('فعال', default=False)
    description = models.CharField('توضیحات', max_length=250)

    @classmethod
    def enabled(cls, key):
        return cls.objects.filter(key=key, is_enabled=True).exists()

    def __str__(self):
        return self.key


class Cart(models.Model):
    session_key = models.CharField(max_length=40, unique=True)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['cart', 'product'], name='unique_cart_product'),
                       models.CheckConstraint(condition=Q(quantity__gte=1) & Q(quantity__lte=20), name='cart_quantity_range')]


class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.PROTECT)
    idempotency_key = models.UUIDField(unique=True)
    total = models.PositiveBigIntegerField()
    status = models.CharField('وضعیت', max_length=30, default='PENDING_REVIEW', editable=False)
    created_at = models.DateTimeField(auto_now_add=True)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    title = models.CharField(max_length=160)
    quantity = models.PositiveIntegerField()
    unit_price = models.PositiveBigIntegerField()


class StockLedger(models.Model):
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    delta = models.IntegerField()
    reason = models.CharField(max_length=250)
    created_at = models.DateTimeField(auto_now_add=True)


class AuditLog(models.Model):
    actor = models.CharField(max_length=150)
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=100)
    changes = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
