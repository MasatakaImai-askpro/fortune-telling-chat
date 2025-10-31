import base64
import uuid
from django.core.files.base import ContentFile
# from django.contrib.auth.models import User
from rest_framework import serializers
from .models import User, FortunetellerProfile, QuerentProfile, BankInfo, Room, Message
from django.db import transaction

class FortunetellerRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(max_length=20)
    headline = serializers.CharField(max_length=30)
    intro = serializers.CharField()
    profile_image = serializers.CharField()
    icon_image = serializers.CharField()

    def _decode_base64_image(self, data_url: str):
        if not data_url.startswith("data:image"):
            return None, None

        format_part, b64str = data_url.split(";base64,")
        ext = format_part.split("/")[-1]
        file_name = f"{uuid.uuid4()}.{ext}"
        file_content = ContentFile(base64.b64decode(b64str), name=file_name)
        return file_name, file_content
    
    @transaction.atomic
    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        name = validated_data["name"]
        headline = validated_data["headline"]
        intro = validated_data["intro"]
        profile_image_str = validated_data["profile_image"]
        icon_image_str = validated_data["icon_image"]

        _, profile_cf = self._decode_base64_image(profile_image_str)
        _, icon_cf = self._decode_base64_image(icon_image_str)

        user = User.objects.create(
            email=email,
            role="2",
        )
        user.set_password(password)
        user.save()

        fortuneteller_profile = FortunetellerProfile.objects.create(
            user=user,
            name=name,
            headline=headline,
            intro=intro,
            profile_image=profile_cf,
            icon_image=icon_cf
        )

        return fortuneteller_profile


class QuerentRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(source="tel_number",max_length=11)
    zipcode = serializers.CharField(source="postal_code", max_length=7)
    address = serializers.CharField(max_length=255)
    birthdate = serializers.DateField()
    zodiac = serializers.CharField(source="zodiac_sign", max_length=3)
    birthplace = serializers.CharField(max_length=50)
    birthtime = serializers.TimeField()
    genre = serializers.CharField(source="worry_category")
    body = serializers.CharField(source="worry_message", max_length=100)
    confirm = serializers.CharField(source="password", write_only=True)

    @transaction.atomic
    def create(self, validated_data):
        name = validated_data["name"]
        email = validated_data["email"]
        tel_number = validated_data["tel_number"]
        postal_code = validated_data["postal_code"]
        address = validated_data["address"]
        birthdate = validated_data["birthdate"]
        zodiac_sign = validated_data["zodiac_sign"]
        birthplace = validated_data["birthplace"]
        birthtime = validated_data["birthtime"]
        worry_category = validated_data["worry_category"]
        worry_message = validated_data["worry_message"]
        password = validated_data["password"]

        user = User.objects.create(
            email=email,
            role="1"
        )
        user.set_password(password)
        user.save()

        querent_pro = QuerentProfile.objects.create(
            user=user,
            name=name,
            tel_number=tel_number,
            postal_code=postal_code,
            address=address,
            birthdate=birthdate,
            zodiac_sign=zodiac_sign,
            birthplace=birthplace,
            birthtime=birthtime,
            worry_category=worry_category,
            worry_message=worry_message
        )

        return querent_pro


class BankInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankInfo
        fields = ['name', 'branch_name', 'account_type', 'account_number', 'account_holder_name']


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["fortuneteller_id", "querent_id"]