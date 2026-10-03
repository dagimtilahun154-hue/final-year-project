import React, { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { ArrowRight, Clock, Info } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Button,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { filterReports } from "./data";
export function ReportsScreen({ navigation }: any) {
  const [filter, setFilter] = useState("This Month");
  const shown = filterReports(filter);
  return (
    <Page title="Reports" subtitle="A look back at Liya’s daycare days.">
      <Card tint="#F1F0F5" style={{ padding: 16 }}>
        <View style={s.row}>
          <Avatar source={artwork.reportsChild} />
          <View>
            <Text size={23} weight="semibold">
              Liya
            </Text>
            <Text size={13} color="#767C86">
              Sunflower Group
            </Text>
          </View>
        </View>
      </Card>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginVertical: 24, flexGrow: 0 }}
        contentContainerStyle={{ gap: 10 }}
      >
        {["Today", "This Week", "This Month", "All"].map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            aria-pressed={filter === f}
            onPress={() => setFilter(f)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 22,
              backgroundColor: filter === f ? "#FFCA32" : "#EFEDF0",
            }}
          >
            <Text size={13} weight="medium">
              {f}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {shown.map((r, i) => (
        <Card
          key={r.id}
          style={{
            marginBottom: 16,
            padding: 22,
            borderLeftWidth: r.present ? 1 : 4,
            borderLeftColor: r.present ? "#F0ECE6" : "#F2B9BB",
          }}
        >
          <View style={s.between}>
            <Text size={19}>{r.date}</Text>
            <Badge
              title={r.present ? "● Present" : "● Absent"}
              tone={r.present ? "green" : "red"}
            />
          </View>
          {r.present ? (
            <>
              <View style={[s.row, { marginVertical: 18 }]}>
                <Badge title={r.mood} tone="neutral" />
                <Badge
                  title={
                    "◷ " +
                    r.activities.filter(
                      (a) => a.kind !== "arrival" && a.kind !== "departure",
                    ).length +
                    " updates"
                  }
                  tone="neutral"
                />
              </View>
              {r.summary ? (
                <Text size={14} color="#6E747E" style={{ marginBottom: 22 }}>
                  {r.summary}
                </Text>
              ) : null}
              <Button
                title="View Report"
                variant={i === 0 ? "primary" : "secondary"}
                icon={i === 0 ? ArrowRight : undefined}
                onPress={() =>
                  navigation.navigate("FullDailyReport", { reportId: r.id })
                }
              />
            </>
          ) : (
            <View
              style={[
                s.row,
                {
                  alignItems: "flex-start",
                  marginTop: 22,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: "#F7F5F7",
                },
              ]}
            >
              <Info size={20} color="#7F8490" />
              <Text size={14} color="#7F8490" style={{ flex: 1 }}>
                {r.summary}
              </Text>
            </View>
          )}
        </Card>
      ))}
    </Page>
  );
}
