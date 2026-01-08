import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from asgiref.sync import sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("WS USER:", self.scope["user"])
        route_kwargs = self.scope["url_route"]["kwargs"]
        fortuneteller_id= route_kwargs.get("fortuneteller_id")
        room_id = route_kwargs.get("room_id")
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return
        
        if room_id is not None:
            self.room_id = str(room_id)
            self.room_group_name = f"room_{self.room_id}"
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
        else:
            self.fortuneteller_id = int(fortuneteller_id)
            self.room_id = None
            self.room_group_name = None

        await self.accept()

        if room_id is not None:
            history = await sync_to_async(self.get_history)(self.room_id, user)
            await self.send(text_data=json.dumps({
                "type": "history",
                "room_id": self.room_id,
                "messages": history
            }))

    async def disconnect(self, close_code):
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        # クライアントからメッセージを受信
        from .models import Room, Message

        data = json.loads(text_data)

        if data["type"] != "chat_message":
            return
        
        sender = data["sender"]
        text = data["text"]
        user = self.scope["user"]

        category = data.get("category")
        point = data.get("point")

        if self.room_id is None:
            room = await sync_to_async(Room.objects.get_or_create_for)(
                fortuneteller_id = self.fortuneteller_id,
                querent_id=user.id
            )
            self.room_id = room.id
            self.room_group_name = f"room_{self.room_id}"

            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

            await self.send(text_data=json.dumps({
                "type": "room_init",
                "room_id": str(self.room_id),
            }))

        else:
            room = await sync_to_async(Room.objects.get)(pk=self.room_id)

        # 送信者が占い師で文字数課金の場合
        if sender == "fortuneteller":
            if category == "length_paying":
                msg_obj = await sync_to_async(self.save_length_paying_message)(
                    room=room,
                    user=user,
                    sender=sender,
                    text=text
                )
            elif category == "healing":
                msg_obj = await sync_to_async(self.save_healing_message)(
                    room=room,
                    user=user,
                    sender=sender,
                    text=text,
                    point=point
                )
            else:
                msg_obj = await sync_to_async(self.save_user_message)(
                    room=room,
                    user=user,
                    sender=sender,
                    text=text,
                    point=None
                )
        if sender == "querent":
            msg_obj = await sync_to_async(self.save_user_message)(
            room=room,
            user=user,
            sender=sender,
            text=text,
            point=point
        )

        # 3. クライアント全員にブロードキャスト
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_message",
                "payload": {
                    "id": str(msg_obj.id),
                    "sender": msg_obj.sender,
                    "text": msg_obj.text,
                    "created_at": msg_obj.created_at.isoformat(),
                    "attachments": [],
                    "free": False,
                }
            }
        )

# 以下ヘルパーメソッド
    async def broadcast_message(self, event):
        # group_send から呼ばれる
        await self.send(text_data=json.dumps({
            "type": "new_message",
            "message": event["payload"]
        }))

    def get_history(self, room_id, user):
        from .models import Room, Message
        
        history = []
        try:
            room_obj = Room.objects.get(id=room_id)
            messages = Message.objects.filter(room=room_obj).all()
            for message in messages:
                iso_created_at = message.created_at.isoformat()
                history.append({
                    "id": str(message.id),
                    "sender": message.sender,
                    "text": message.text,
                    "created_at": iso_created_at,
                    "attachments": [],
                    "free": False,
                })
            return history
        except Exception as e:
            print(e)
        return []

    def save_user_message(self, room, user, sender, text, point):
        from .models import Message, QuerentProfile
        from django.db import transaction
        if point is None:
            message_obj = Message.objects.create(
                room=room,
                sender=sender,
                text=text
            )
            return message_obj
        else:
            message_obj = Message.objects.create(
                room=room,
                sender=sender,
                text=text,
                cost_pt=point
            )
            que_prof = QuerentProfile.objects.get(user=user)
            que_obj = 
            return message_obj
    
    def save_length_paying_message(self, room, user, sender, text):
        from .models import Message
        # 文字数をカウントする
        text_len = len(text)
        # ランクに応じて消費ポイント計算？？
        # 場合によってはuser取得する。使用ポイントの定義はsettingを想定
        cost_pt = text_len * 2
        # is_lockedをTrueにしてクリエイト
        message_obj = Message.objects.create(
            room=room,
            sender=sender,
            text=text,
            cost_pt=cost_pt,
            is_locked=True
        )
        return message_obj
    
    def save_healing_message(self, room, user, sender, text, point):
        from .models import Message
        cost_pt = point
        # is_lockedをTrueにしてクリエイト
        message_obj = Message.objects.create(
            room=room,
            sender=sender,
            text=text,
            cost_pt=cost_pt,
            is_locked=True
        )
        return message_obj

    
    def fake_advisor_reply(self, user_text):
        # ダミーの占い師メッセ
        return "これはサンプルのリーディング結果です。安心してくださいね。"
