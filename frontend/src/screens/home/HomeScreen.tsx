import React from "react";
import { View, Image, Pressable } from "react-native";
import {
  ChatCircle,
  FileText,
  Robot,
  CalendarBlank,
  ForkKnife,
  Moon,
  PuzzlePiece,
  Car,
  Smiley,
  Eye,
  Palette,
  ArrowRight,
  ArrowBendUpLeft,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  CardGlow,
  Avatar,
  Badge,
  Section,
  Button,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useAuth } from "../../context/AuthContext";
import { useChild } from "../../context/ChildContext";
const highlights = [
  {
    title: "Breakfast completed",
    label: "MEALS",
    Icon: ForkKnife,
    bg: "#FFF7CF",
    ink: "#DD7B13",
  },
  {
    title: "Nap: 1h 15m",
    label: "SLEEP",
    Icon: Moon,
    bg: "#F1EDF6",
    ink: "#6745AF",
  },
  {
    title: "Colors & Shapes",
    label: "LEARNING",
    Icon: PuzzlePiece,
    bg: "#E8F6F3",
    ink: "#008794",
  },
  {
    title: "Outdoor Play",
    label: "PLAY",
    Icon: Car,
    bg: "#F0F6E8",
    ink: "#3B813C",
  },
  {
    title: "Happy ☺",
    label: "MOOD",
    Icon: Smiley,
    bg: "#FFF0E9",
    ink: "#CC423E",
  },
  {
    title: "Doing great today",
    label: "OBSERVATION",
    Icon: Eye,
    bg: "#FDEDED",
    ink: "#BD4264",
  },
];
export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { selectedChild } = useChild();
  const child = selectedChild?.full_name.split(" ")[0] || "Liya";
  const report = () => navigation.navigate("FullDailyReport", { reportId: 1 });
  const actions = [
    {
      label: "Message",
      Icon: ChatCircle,
      bg: "#F0F4F3",
      run: () => navigation.navigate("CaregiverChat", { threadId: 1 }),
    },
    { label: "Report", Icon: FileText, bg: "#FFF0C7", run: report },
    {
      label: "Ask AI",
      Icon: Robot,
      bg: "#EBE8F6",
      run: () => navigation.navigate("AIGuide"),
    },
    {
      label: "Calendar",
      Icon: CalendarBlank,
      bg: "#FDEBD5",
      run: () => navigation.navigate("Calendar"),
    },
  ];
  return (
    <Page contentStyle={{ paddingHorizontal: 28 }}>
      <Text size={16}>
        Good morning, {user?.name?.split(" ")[0] || "Hana"} 👋
      </Text>
      <Text
        color="#6F727A"
        size={16}
        style={{ marginTop: 7, marginBottom: 24 }}
      >
        Here’s how {child}’s day is going.
      </Text>
      <Card
        onPress={() =>
          navigation.navigate("ChildProfile", { childId: selectedChild?.id })
        }
        style={{ padding: 18, overflow: "hidden" }}
      >
        <CardGlow />
        <View style={s.row}>
          <Avatar source={artwork.child} size={66} />
          <View style={{ flex: 1 }}>
            <View style={s.between}>
              <Text size={18} weight="medium">
                {child}
              </Text>
              <Badge title="● AT DAYCARE" />
            </View>
            <Text size={13} color="#6A6F78" style={{ marginTop: 5 }}>
              4 years · Sunflower Group
            </Text>
            <Text size={13} color="#7E828A" style={{ marginTop: 7 }}>
              Checked in at 8:04 AM
            </Text>
          </View>
        </View>
      </Card>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 24,
        }}
      >
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={a.run}
            style={{ alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 57,
                height: 57,
                borderRadius: 20,
                backgroundColor: a.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <a.Icon size={24} color="#132739" weight="fill" />
            </View>
            <Text size={11} color="#555E69">
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Section title="Today’s Highlights" action="View All" onPress={report} />
      <View style={s.grid}>
        {highlights.map((h) => (
          <Pressable
            key={h.label}
            accessibilityRole="button"
            accessibilityLabel={h.label + ": " + h.title}
            onPress={report}
            style={{
              width: "48%",
              minHeight: 132,
              padding: 16,
              borderRadius: 23,
              backgroundColor: h.bg,
              overflow: "hidden",
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: -16,
                bottom: -12,
                opacity: 0.06,
              }}
            >
              <h.Icon size={83} color={h.ink} weight="fill" />
            </View>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: h.bg,
                marginBottom: 8,
                justifyContent: "center",
              }}
            >
              <h.Icon size={25} color={h.ink} weight="fill" />
            </View>
            <Text size={10} color={h.ink} style={{ marginBottom: 5 }}>
              {h.label}
            </Text>
            <Text size={14} weight="medium" color={h.ink}>
              {h.title}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card
        style={{ marginTop: 24, padding: 0, overflow: "hidden" }}
        onPress={report}
      >
        <View
          style={[
            s.between,
            {
              paddingHorizontal: 18,
              paddingVertical: 12,
              backgroundColor: "#FFF6DA",
            },
          ]}
        >
          <View style={s.row}>
            <Palette size={18} color="#D78B23" />
            <Text size={11} color="#C78020" style={{ letterSpacing: 0.8 }}>
              LATEST ACTIVITY
            </Text>
          </View>
          <Text size={10} color="#C78020">
            10:30 AM
          </Text>
        </View>
        <View style={[s.row, { padding: 16, alignItems: "flex-start" }]}>
          <Image
            source={artwork.painting}
            style={{ width: 98, height: 104, borderRadius: 14 }}
          />
          <View style={{ flex: 1 }}>
            <Text size={18} weight="medium">
              Painting Time 🎨
            </Text>
            <Text
              size={14}
              color="#707782"
              style={{ marginTop: 4 }}
              numberOfLines={3}
            >
              {child} explored finger paints and made a colorful picture.
            </Text>
          </View>
        </View>
      </Card>
      <Card tint="#F4F5ED" style={{ marginTop: 24, overflow: "hidden" }}>
        <CardGlow color="#C9DEEF" />
        <View style={s.row}>
          <Avatar source={artwork.caregiver} size={42} />
          <View>
            <Text weight="medium">Sara (Caregiver)</Text>
            <Text size={11} color="#858990">
              Sent 1 hour ago
            </Text>
          </View>
        </View>
        <Text color="#606B74" style={{ marginTop: 16, marginBottom: 20 }}>
          “{child} had a great morning! She helped during cleanup and shared her
          toys with the group.”
        </Text>
        <Button
          title="Reply to Sara"
          icon={ArrowBendUpLeft}
          variant="outline"
          style={{ backgroundColor: "#fff" }}
          onPress={() => navigation.navigate("CaregiverChat", { threadId: 1 })}
        />
      </Card>
      <Card
        style={{ marginTop: 24, borderColor: "#E3E5F5" }}
        onPress={() => navigation.navigate("EventDetail", { eventId: 1 })}
      >
        <View style={s.row}>
          <View
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: "#EDEBF7",
              alignItems: "center",
            }}
          >
            <Text size={10} color="#6566A0">
              AUG
            </Text>
            <Text size={21} color="#6566A0">
              28
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text size={16} weight="medium">
              Parent Meeting
            </Text>
            <Text size={13} color="#747984">
              Friday, 3:00 PM
            </Text>
          </View>
          <ArrowRight size={24} />
        </View>
      </Card>
    </Page>
  );
}
