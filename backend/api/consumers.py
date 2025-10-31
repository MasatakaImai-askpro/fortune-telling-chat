import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        route_kwargs = self.scope["url_route"]["kwargs"]
        fortuneteller_id= route_kwargs.get("fortuneteller_id")
        room_id = route_kwargs.get("room_id")

        if fortuneteller_id is not None:
            self.fortuneteller_id = int(fortuneteller_id)
            self.room_group_name = f"fortuneteller_{self.fortuneteller_id}"
        else:
            self.room_id = room_id
            self.room_group_name = f"room_{self.room_id}"

        # 認証チェック（ログインしてるか、このthreadにアクセス権あるかなど）
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return

        # group に join
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # 最初に過去ログを流してあげる（初期描画用）
        # 例: thread_id から Message をDBから引いて serialize
        history = await self.get_history(self.room_id, user)
        await self.send(text_data=json.dumps({
            "type": "history",
            "messages": history
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        # クライアントからメッセージを受信
        data = json.loads(text_data)

        if data["type"] == "chat_message":
            text = data["text"]          # ユーザー入力
            user = self.scope["user"]

            # 1. ポイント計算・課金ロジックなど（ここは好きに）
            # 2. DB保存
            msg_obj = await self.save_user_message(
                thread_id=self.thread_id,
                user=user,
                text=text
            )

            # 3. クライアント全員にブロードキャスト
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_message",
                    "payload": {
                        "id": str(msg_obj.id),
                        "role": "user",
                        "text": msg_obj.text,
                        "createdAt": int(msg_obj.created_at.timestamp() * 1000),
                        "free": False,
                    }
                }
            )

            # 4. 占い師の自動返信を生成して同じくブロードキャスト
            reply_text = self.fake_advisor_reply(text)
            advisor_msg_obj = await self.save_advisor_message(
                thread_id=self.thread_id,
                text=reply_text
            )

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_message",
                    "payload": {
                        "id": str(advisor_msg_obj.id),
                        "role": "advisor",
                        "text": advisor_msg_obj.text,
                        "createdAt": int(advisor_msg_obj.created_at.timestamp() * 1000),
                        "opened": True,
                    }
                }
            )

    async def broadcast_message(self, event):
        # group_send から呼ばれる
        await self.send(text_data=json.dumps({
            "type": "new_message",
            "message": event["payload"]
        }))

    # ------- helper methods (DB accessなど。実際はsync_to_asyncでラップする) -------

    async def get_history(self, thread_id, user):
        # DBからメッセージを取って [{id, role, text, createdAt, ...}, ...] で返す
        # 実装は sync_to_async で Message.objects.filter(...).order_by(...) みたいにやる
        return []

    async def save_user_message(self, thread_id, user, text):
        # DBに保存して返す
        # return message_instance
        ...

    async def save_advisor_message(self, thread_id, text):
        ...
    
    def fake_advisor_reply(self, user_text):
        # ダミーの占い師メッセ
        return "これはサンプルのリーディング結果です。安心してくださいね。"
