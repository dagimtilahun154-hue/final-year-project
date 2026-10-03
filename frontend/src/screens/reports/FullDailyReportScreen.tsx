import React from "react";
import { View } from "react-native";
import {
  SignIn,
  SignOut,
  ForkKnife,
  Moon,
  Palette,
  PuzzlePiece,
  Tree,
  Smiley,
  ChatCircle,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Section,
  Button,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { reports, previewToday } from "./data";
const activityStyle = {
  arrival: { Icon: SignIn, bg: "#E7EFFC", ink: "#557DAA" },
  departure: { Icon: SignOut, bg: "#E7EFFC", ink: "#557DAA" },
  meal: { Icon: ForkKnife, bg: "#FFF1C7", ink: "#B48420" },
  learning: { Icon: PuzzlePiece, bg: "#E7F5F4", ink: "#368C95" },
  play: { Icon: Tree, bg: "#EAF3E6", ink: "#578458" },
  sleep: { Icon: Moon, bg: "#EEEAF7", ink: "#8270AC" },
  art: { Icon: Palette, bg: "#FCECD9", ink: "#B78652" },
};
export function FullDailyReportScreen({ navigation, route }: any) {
  const report = reports.find((r) => r.id === (route.params?.reportId ?? 1));
  if (!report || !report.present)
    return (
      <Page title="Daily Report" back tabs activeTab="Reports">
        <Card>
          <Text>{report ? report.summary : "This report is unavailable."}</Text>
        </Card>
      </Page>
    );
  const activities = report.activities.map((a) => ({
    ...a,
    ...activityStyle[a.kind],
  }));
  return (
    <Page
      title="Liya’s Day"
      subtitle={report.date + ", " + report.isoDate.slice(0, 4)}
      back
      tabs
      activeTab="Reports"
    >
      <Card tint="#F2F0F8">
        <View style={s.row}>
          <Avatar source={artwork.child} />
          <View>
            <Text size={18} weight="semibold">
              Liya
            </Text>
            <Text size={13} color="#7B7F89">
              4 years · Sunflower Group
            </Text>
          </View>
        </View>
      </Card>
      <Section title="Attendance" />
      <Card>
        <View style={s.between}>
          <View style={s.row}>
            <SignIn size={22} color="#6384AA" />
            <View>
              <Text size={12} color="#7B818D">
                Checked in
              </Text>
              <Text weight="medium">{report.checkIn}</Text>
            </View>
          </View>
          <Badge
            title={report.checkOut ? "Collected" : "● At daycare"}
            tone={report.checkOut ? "neutral" : "green"}
          />
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <SignOut size={22} color="#9297A1" />
          <View>
            <Text size={12} color="#7B818D">
              Checked out
            </Text>
            <Text color="#7B818D">{report.checkOut || "Not yet"}</Text>
          </View>
        </View>
      </Card>
      <Section
        title={
          report.isoDate === previewToday
            ? "Today’s Timeline"
            : "Day’s Timeline"
        }
      />
      {activities.map((a, i) => (
        <View key={a.time} style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ width: 34, alignItems: "center" }}>
            <View
              style={{
                backgroundColor: a.bg,
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <a.Icon size={19} color={a.ink} />
            </View>
            {i < activities.length - 1 && (
              <View
                style={{
                  width: 1,
                  flex: 1,
                  backgroundColor: "#DDDDE0",
                  marginVertical: 5,
                }}
              />
            )}
          </View>
          <Card style={{ flex: 1, marginBottom: 16, padding: 17 }}>
            <Text size={11} color={a.ink}>
              {a.time}
            </Text>
            <Text size={17} weight="medium" style={{ marginVertical: 5 }}>
              {a.title}
            </Text>
            <Text size={13} color="#737C87">
              {a.note}
            </Text>
          </Card>
        </View>
      ))}
      <Section title="Daily Summary" />
      <Card>
        {[
          ["Mood", report.mood],
          [
            "Behavior",
            report.mood === "Calm"
              ? "Calm and engaged"
              : "Active and cooperative",
          ],
          ["Health", "No unusual observations"],
          ["General", report.summary],
        ].map(([label, value], i) => (
          <View
            key={label}
            style={{
              paddingVertical: 10,
              borderBottomWidth: i === 3 ? 0 : 1,
              borderBottomColor: "#F1EFEC",
            }}
          >
            <Text size={12} color="#7B818D">
              {label}
            </Text>
            <Text weight="medium">{value}</Text>
          </View>
        ))}
      </Card>
      <Card tint="#0C263E" style={{ marginTop: 24 }}>
        <View style={s.row}>
          <Avatar source={artwork.caregiver} size={38} />
          <View>
            <Text color="#fff" weight="medium">
              Caregiver Note
            </Text>
            <Text color="#BDC9D7" size={12}>
              From Sara
            </Text>
          </View>
        </View>
        <Text color="#E4EAF1" size={14} style={{ marginTop: 18 }}>
          {report.caregiverNote}
        </Text>
      </Card>
      <Button
        title="Message Caregiver"
        icon={ChatCircle}
        onPress={() => navigation.navigate("CaregiverChat", { threadId: 1 })}
        style={{ marginTop: 24 }}
      />
    </Page>
  );
}
