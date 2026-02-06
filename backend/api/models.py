from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
import uuid


class CreatedAtModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    # def create_superuser(self, email, password=None, **extra_fields):
    #     extra_fields.setdefault("is_staff", True)
    #     extra_fields.setdefault("is_superuser", True)
    #     extra_fields.setdefault("is_active", True)

    #     if extra_fields.get("is_staff") is not True:
    #         raise ValueError("Superuser must have is_staff=True.")
    #     if extra_fields.get("is_superuser") is not True:
    #         raise ValueError("Superuser must have is_superuser=True.")

    #     return self.create_user(email, password, **extra_fields)

    def get_by_natural_key(self, email):
        return self.get(email=email)
    
class RoomManager(models.Manager):
    def get_or_create_for(self, fortuneteller_id, querent_id):
        room, created = self.get_or_create(
            fortuneteller_id=fortuneteller_id,
            querent_id=querent_id
        )
        return room


class User(AbstractBaseUser, PermissionsMixin, CreatedAtModel):
    class Roles(models.TextChoices):
        QUERENT = "1", "相談者"
        FORTUNETELLER = "2", "占い師"
        ADMIN = "3", "管理者"

    email = models.EmailField(max_length=100, unique=True)
    role = models.CharField(max_length=1, choices=Roles.choices)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["role"]

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.id}"


class FortunetellerProfile(CreatedAtModel):
    class Ranks(models.TextChoices):
        SILVER = "SILVER", "シルバー"
        GOLD = "GOLD", "ゴールド"
        PLATINUM = "PLATINUM", "プラチナ"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="fortune_pro", primary_key=True
    )
    name = models.CharField(max_length=20)
    headline = models.CharField(max_length=30)
    intro = models.TextField(max_length=1000)
    rank = models.CharField(max_length=8, choices=Ranks.choices, default=Ranks.SILVER)
    profile_image = models.ImageField(upload_to="profile_images/")
    icon_image = models.ImageField(upload_to="icon_images/")
    is_recommended = models.BooleanField(default=False)


class QuerentProfile(CreatedAtModel):
    class ZodiacSigns(models.TextChoices):
        ARIES = "牡羊座", "牡羊座"
        TAURUS = "牡牛座", "牡牛座"
        GEMINI = "双子座", "双子座"
        CANCER = "蟹座", "蟹座"
        LEO = "獅子座", "獅子座"
        VIRGO = "乙女座", "乙女座"
        LIBRA = "天秤座", "天秤座"
        SCORPIO = "蠍座", "蠍座"
        SAGITTARIUS = "射手座", "射手座"
        CAPRICORN = "山羊座", "山羊座"
        AQUARIUS = "水瓶座", "水瓶座"
        PISCES = "魚座", "魚座"

    class Genres(models.TextChoices):
        ROMANCE = "恋愛", "恋愛"
        WORK = "仕事", "仕事"
        RELATIONSHIP = "人間関係", "人間関係"
        MONEY = "金運", "金運"
        HEALTH = "健康", "健康"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="querent_pro", primary_key=True
    )
    name = models.CharField(max_length=20)
    tel_number = models.CharField(max_length=11)
    postal_code = models.CharField(max_length=7)
    address = models.CharField(max_length=255)
    birthdate = models.DateField()
    zodiac_sign = models.CharField(max_length=3, choices=ZodiacSigns.choices)
    birthplace = models.CharField(max_length=50)
    birthtime = models.TimeField()
    worry_category = models.CharField(max_length=4, choices=Genres.choices)
    worry_message = models.TextField(max_length=1000)
    is_subscription = models.BooleanField(default=False)
    points = models.IntegerField(default=0)


class BankInfo(CreatedAtModel):
    class AccountTypes(models.TextChoices):
        CHECKING = "普通", "普通"
        BUSINESS = "法人", "法人"
        CURRENT = "当座", "当座"
        SAVINGS = "貯蓄", "貯蓄"

    user = models.OneToOneField(
        FortunetellerProfile,
        on_delete=models.CASCADE,
        related_name="fortune_pro",
        primary_key=True,
    )
    name = models.CharField(max_length=30, null=True, blank=True)
    branch_name = models.CharField(max_length=20, null=True, blank=True)
    account_type = models.CharField(
        max_length=2, choices=AccountTypes.choices, null=True, blank=True
    )
    account_number = models.CharField(max_length=7, null=True, blank=True)
    account_holder_name = models.CharField(max_length=20, null=True, blank=True)


class Room(CreatedAtModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fortuneteller = models.ForeignKey(
        FortunetellerProfile,
        on_delete=models.CASCADE,
        related_name="room_for"
    )
    querent = models.ForeignKey(
        QuerentProfile,
        on_delete=models.CASCADE,
        related_name="room_que"
    )

    objects = RoomManager()

    class Meta:
        unique_together = ("querent", "fortuneteller")


class Message(models.Model):
    class Sender(models.TextChoices):
        FORTUNETELLER = "fortuneteller", "占い師"
        QUERENT = "querent", "相談者"

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="room"
    )
    sender = models.CharField(
        max_length=13, choices=Sender.choices)
    text = models.TextField(null=True, blank=True)
    file = models.FileField(upload_to="message_files/", null=True, blank=True)
    cost_pt = models.IntegerField(max_length=5, null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
