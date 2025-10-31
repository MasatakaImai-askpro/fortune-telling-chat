from django.shortcuts import render
from django.contrib.auth import authenticate, login
from django.db import transaction
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from .models import User, FortunetellerProfile, QuerentProfile, BankInfo, Room, Message
from .serializers import FortunetellerRegistrationSerializer, BankInfoSerializer, RoomSerializer, QuerentRegistrationSerializer
from rest_framework.permissions import IsAuthenticated


class HelloView(APIView):
    def get(self, request):
        return Response({"message": "Hello from Django!"})

# 相談者登録ビュー
class QuerentRegistrationView(APIView):
    def post(self, request):
        data = request.data
        if data:
            serializer = QuerentRegistrationSerializer(data=data)
            try:
                if serializer.is_valid(raise_exception=True):
                    serializer.save()
                    return Response(status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response(f"エラーが発生しました: {e}",status=status.HTTP_400_BAD_REQUEST)
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # data = request.data
        # if data:
        #     name = data.get("name")
        #     email = data.get("email")
        #     phone = data.get("phone")
        #     zipcode = data.get("zipcode")
        #     address = data.get("address")
        #     birthdate = data.get("birthdate")
        #     zodiac_sign = data.get("zodiac")
        #     birthplace = data.get("birthplace")
        #     birthtime = data.get("birthtime")
        #     worry_category = data.get("genre")
        #     worry_message = data.get("body")
        #     password = data.get("conform")
        # try:
        #     with transaction.atomic():
        #         user = User(email=email, role="1")
        #         user.set_password(password)
        #         user.save()
        #         QuerentProfile.objects.create(
        #             user=user,
        #             name=name,
        #             tel_number=phone,
        #             postal_code=zipcode,
        #             address=address,
        #             birthdate=birthdate,
        #             zodiac_sign=zodiac_sign,
        #             birthplace=birthplace,
        #             birthtime=birthtime,
        #             worry_category=worry_category,
        #             worry_message=worry_message,
        #         )
        #     return Response(status=status.HTTP_201_CREATED)
        # except Exception as e:
        #     print(f"会員登録失敗:{e}")
        #     return Response(status=status.HTTP_400_BAD_REQUEST)


# 占い師登録ビュー
class FortunetellerRegistrationView(APIView):
    def post(self, request):
        data = request.data
        if data:
            serializer = FortunetellerRegistrationSerializer(data=data)
            try:
                if serializer.is_valid(raise_exception=True):
                    serializer.save()
                    return Response(status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response(f"エラーが発生しました: {e}",status=status.HTTP_400_BAD_REQUEST)
            return Response(status=status.HTTP_400_BAD_REQUEST)


# カルテ編集
class QuerentKarteView(APIView):
    def post(self, request):
        data = request.data.copy
        birthday = data.get("birthday")
        zodiac = data.get("zodiac")
        birthplace = data.get("birthplace")
        birthtime = data.get("birthtime")
        genre = data.get("genre")
        body = data.get("body")
        return Response(status=status.HTTP_201_CREATED)

class UserLogin(APIView):
    def post(self, request):
        data = request.data
        if data:
            email = data.get("email")
            pw = data.get("password")
            login_role = data.get("role")

            user = authenticate(request, email=email, password=pw)
            if user is not None:
                if user.role != login_role:
                    return Response({"error": "ログイン画面が異なります。"}, status=status.HTTP_401_UNAUTHORIZED)
                login(request ,user)
                return Response(
                    {
                        "message":"ログイン成功",
                        "user_role": user.role
                    },
                    status.HTTP_200_OK)
            else:
                return Response({"error": "認証に失敗しました"}, status=status.HTTP_401_UNAUTHORIZED)

class GETFortuneTeller(APIView):
    def get(self, request):
        fortunetellers = FortunetellerProfile.objects.all()
        fortuneteller_list = []
        for fortuneteller in fortunetellers:
            fortuneteller_list.append({
                "id":fortuneteller.user.id,
                "name":fortuneteller.name,
                "rank":fortuneteller.rank,
                # ここは後ほど書き換え
                "tags": ["霊視", "スピリチュアル", "恋愛"], 
                "profile_image":request.build_absolute_uri(fortuneteller.profile_image.url),
                "icon_image":request.build_absolute_uri(fortuneteller.icon_image.url),
                "headline": fortuneteller.headline,
                "intro": fortuneteller.intro,
                "is_recommended":fortuneteller.is_recommended
            })
        return Response(fortuneteller_list,status=status.HTTP_200_OK)

# 占い師のプロフィール
class FortunetellerInfo(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        if user.role != "2":
            return Response(status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "id": user.id,
            "name": user.fortune_pro.name,
            "rank": user.fortune_pro.rank,
            "headline": user.fortune_pro.headline,
            "intro": user.fortune_pro.intro
        }, status=status.HTTP_200_OK)
    
    def put(self,request):
        data = request.data
        name = data.get("name")
        headline = data.get("headline")
        intro = data.get("intro")
        user = request.user
        if user:
            try:
                pro_obj = FortunetellerProfile.objects.get(user=user)
                pro_obj.name=name,
                pro_obj.headline=headline,
                pro_obj.intro=intro
                pro_obj.save()
                return Response(status=status.HTTP_200_OK)
            except Exception as e:
                print(e)
                return Response(status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(status=status.HTTP_400_BAD_REQUEST)


# 占い師の口座情報
class FortunetellerBankInfo(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        fortune_pro = FortunetellerProfile.objects.get(user=user)
        bank_infos = BankInfo.objects.filter(user=fortune_pro).first()
        if bank_infos is None:
            return Response({
                "name":"",
                "branch_name":"",
                "account_type": "",
                "account_number": "",
                "acount_holder_name":"", 
            }, status=status.HTTP_200_OK)
        else:
            serializer = BankInfoSerializer(bank_infos)
            # print(serializer.data)
            return Response(serializer.data, status=status.HTTP_200_OK)

    
    def put(self, request):
        data = request.data.copy()
        fortune_pro = FortunetellerProfile.objects.get(user=request.user)
        bank_info = BankInfo.objects.filter(user=fortune_pro).first()
        if bank_info:
            serializer = BankInfoSerializer(
                instance=bank_info,
                data=data
            )
        else:
            serializer = BankInfoSerializer(data=data)

        if serializer.is_valid(raise_exception=True):
            if bank_info:
                serializer.save(user=fortune_pro)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                serializer.save(user=fortune_pro)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
class chatRoomInfo(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        fortuneteller_id = request.query_params.get("fortuneteller")

        if not fortuneteller_id:
            return Response({"error": "advisor required"}, status=400)
        
        fortuneteller_user = User.objects.get(id=fortuneteller_id)
        fortuneteller_pro_obj = FortunetellerProfile.objects.get(user=fortuneteller_user)
        querent_user = User.objects.get(id=request.user.id)
        querent_pro_obj = QuerentProfile.objects.get(user=querent_user)

        room = Room.objects.filter(fortuneteller_id=fortuneteller_pro_obj, querent_id=querent_pro_obj)
        if room:
            return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)
        else:
            return Response([], status=status.HTTP_200_OK)



