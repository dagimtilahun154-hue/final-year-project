import React, { useState } from "react";
import { View, TextInput, Pressable, Image } from "react-native";
import {
  ArrowLeft,
  PaperPlaneRight,
  Lock,
  Palette,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Avatar,
  IconButton,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
type Message = {
  id: number;
  mine: boolean;
  text: string;
  time: string;
  photo?: boolean;
};
export function CaregiverChatScreen({ navigation, route }: any) {
  const office = route.params?.threadId === 2;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(
    office
      ? [
          {
            id: 1,
            mine: false,
            text: "A reminder about Friday’s parent meeting at 3:00 PM.",
            time: "Yesterday",
          },
        ]
      : [
          {
            id: 1,
            mine: false,
            text: "Liya had a great morning today. She especially enjoyed painting with her classmates.",
            time: "11:15 AM",
            photo: true,
          },
          {
            id: 2,
            mine: true,
            text: "Thank you for the update. Did she finish her lunch today?",
            time: "11:18 AM",
          },
          {
            id: 3,
            mine: false,
            text: "Yes, she ate most of her lunch and is doing well.",
            time: "11:21 AM",
          },
        ],
  );
  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { id: Date.now(), mine: true, text: input.trim(), time: "Preview" },
    ]);
    setInput("");
  };
  return (
    <Page
      header={false}
      toolbar={
        <View style={[s.row, { paddingVertical: 16, paddingHorizontal: 20 }]}>
          <IconButton
            icon={ArrowLeft}
            label="Go back"
            onPress={() => navigation.goBack()}
          />
          <Avatar
            source={office ? undefined : artwork.caregiver}
            initials="AN"
            size={43}
          />
          <View style={{ flex: 1 }}>
            <Text size={20} weight="semibold">
              {office ? "Daycare Office" : "Sara"}
            </Text>
            <Text size={12} color="#7D838C">
              {office ? "Ankelba Early Learning" : "Liya’s caregiver"}
            </Text>
          </View>
        </View>
      }
      scrollToEnd={messages.some((message) => message.time === "Preview")}
      contentStyle={{ paddingTop: 0, paddingHorizontal: 20 }}
      footer={
        <View>
          <View style={s.inputWrap}>
            <TextInput
              accessibilityLabel="Message"
              placeholder="Type a message…"
              style={s.input}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!input.trim()}
              onPress={send}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "#061224",
                alignItems: "center",
                justifyContent: "center",
                opacity: input.trim() ? 0.99 : 0.4,
              }}
            >
              <PaperPlaneRight color="white" size={20} weight="fill" />
            </Pressable>
          </View>
        </View>
      }
    >
      <View
        style={[
          s.row,
          {
            justifyContent: "center",
            backgroundColor: "#F0EFF0",
            borderRadius: 22,
            padding: 10,
            marginBottom: 24,
          },
        ]}
      >
        <Lock size={15} color="#7D838C" />
        <Text size={11} color="#7D838C">
          Preview conversation
        </Text>
      </View>
      <Text
        size={11}
        color="#9296A0"
        style={{ textAlign: "center", marginBottom: 24 }}
      >
        {office ? "YESTERDAY" : "TODAY"}
      </Text>
      {messages.map((m) => (
        <View
          key={m.id}
          style={{
            maxWidth: "86%",
            alignSelf: m.mine ? "flex-end" : "flex-start",
            marginBottom: 24,
          }}
        >
          <View
            style={{
              padding: 17,
              borderRadius: 22,
              borderBottomRightRadius: m.mine ? 5 : 22,
              borderBottomLeftRadius: m.mine ? 22 : 5,
              backgroundColor: m.mine ? "#10263D" : "#FFF",
              borderWidth: m.mine ? 0 : 1,
              borderColor: "#EEEDEA",
            }}
          >
            <Text size={14} color={m.mine ? "#FFF" : "#4D5663"}>
              {m.text}
            </Text>
            {m.photo && (
              <View
                style={{
                  marginTop: 14,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: "#F5F7FA",
                }}
              >
                <Image
                  source={artwork.painting}
                  style={{ height: 130, width: "100%" }}
                />
                <View style={{ padding: 11 }}>
                  <Text size={13} weight="medium">
                    Painting Activity
                  </Text>
                  <Text size={11} color="#8391A4">
                    Today · 10:30 AM
                  </Text>
                </View>
              </View>
            )}
          </View>
          <Text
            size={10}
            color="#8B919B"
            style={{ marginTop: 6, textAlign: m.mine ? "right" : "left" }}
          >
            {m.time}
            {m.mine && m.time !== "Preview" ? " ✓✓" : ""}
          </Text>
        </View>
      ))}
    </Page>
  );
}
