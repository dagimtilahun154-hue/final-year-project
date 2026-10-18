import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { ShieldCheck, Fingerprint, House, Check } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useChild } from "../../context/ChildContext";
import { getChildGuardians, getChildAttendance, GuardianRecord, AttendanceRecord } from "../../api/parentApi";
import { pickupSteps } from "../../utils/pickup";

export function PickupVerificationScreen({ route, navigation }: any) {
  const { selectedChild } = useChild();
  const [guardians, setGuardians] = useState<GuardianRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const targetGuardianId = route.params?.guardianId;

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!selectedChild?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [gList, attList] = await Promise.all([
          getChildGuardians(selectedChild.id).catch(() => []),
          getChildAttendance(selectedChild.id).catch(() => []),
        ]);
        if (active) {
          setGuardians(gList);
          const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(new Date());
          const todayAtt = attList.find((a) => (a.event_time || "").slice(0, 10) === todayStr) || attList[0] || null;
          setAttendance(todayAtt);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [selectedChild?.id]);

  if (loading) {
    return (
      <Page title="Pickup Status" back>
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#061224" />
          <Text size={13} color="#8A919B" style={{ marginTop: 12 }}>
            Loading pickup status…
          </Text>
        </View>
      </Page>
    );
  }

  const guardian =
    guardians.find((g) => g.guardian_link_id === targetGuardianId || g.user_id === targetGuardianId) ||
    guardians[0];

  if (!guardian) {
    return (
      <Page title="Pickup Status" back>
        <Notice>No authorized guardian found for {selectedChild?.full_name || "this child"}.</Notice>
      </Page>
    );
  }

  const childName = selectedChild?.full_name ? selectedChild.full_name.split(" ")[0] : "Child";
  const groupName = selectedChild?.group_name || "Daycare Group";
  const isCheckedOut = attendance?.event_type === "checkout";
  const isCheckedIn = attendance?.event_type === "checkin";

  // Step states based on real database records
  const states: ("complete" | "current" | "pending")[] = [
    guardian.pickup_authorized ? "complete" : "current",
    guardian.pickup_authorized && guardian.biometric_enrolled
      ? "complete"
      : guardian.pickup_authorized
      ? "current"
      : "pending",
    isCheckedOut ? "complete" : isCheckedIn ? "current" : "pending",
  ];

  const steps = [
    {
      title: "Guardian authorized",
      detail: guardian.pickup_authorized
        ? `Approved to collect ${childName}.`
        : "Awaiting daycare office authorization.",
      Icon: ShieldCheck,
    },
    {
      title: "Identity verified",
      detail: guardian.biometric_enrolled
        ? "Biometric identity enrolled and verified at front desk."
        : "Front-desk staff verify photo ID or biometric PIN at pickup.",
      Icon: Fingerprint,
    },
    {
      title: isCheckedOut ? "Checked out" : isCheckedIn ? "At daycare" : "Awaiting check-in",
      detail: isCheckedOut
        ? `Checked out at ${new Date(attendance!.event_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
        : isCheckedIn
        ? `Checked in at daycare. Staff will confirm when ${childName} leaves.`
        : "Attendance event recorded by daycare staff.",
      Icon: House,
    },
  ];

  return (
    <Page title="Pickup Status" back tabs activeTab="Profile">
      <Card tint="#F1F5EC">
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Avatar source={artwork.child} size={58} />
          <View style={{ flex: 1, minWidth: 80 }}>
            <Text size={21} weight="semibold">
              {selectedChild?.full_name || childName}
            </Text>
            <Text size={12} color="#687C72">
              {groupName}
            </Text>
          </View>
          <Badge
            title={isCheckedOut ? "● Checked Out" : isCheckedIn ? "● At Daycare" : "● Not Checked In"}
            tone={isCheckedOut ? "neutral" : isCheckedIn ? "green" : "gold"}
          />
        </View>
      </Card>
      <Card style={{ marginTop: 18, padding: 22 }}>
        <View
          style={[s.between, { marginBottom: 24, flexWrap: "wrap", gap: 8 }]}
        >
          <Text size={19} weight="semibold">
            Pickup journey
          </Text>
          <Badge title="Preview" tone="neutral" />
        </View>
        {steps.map(({ title, detail, Icon }, index) => {
          const state = states[index];
          const complete = state === "complete";
          const current = state === "current";
          const ink = complete ? "#3D795A" : current ? "#8A6A25" : "#7C8490";
          return (
            <View key={title} style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ width: 42, alignItems: "center" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: complete
                      ? "#E8F3E9"
                      : current
                        ? "#FFF2CC"
                        : "#F2F1F3",
                    borderWidth: current ? 1.5 : 0,
                    borderColor: "#D1B366",
                  }}
                >
                  {complete ? (
                    <Check size={22} color={ink} weight="bold" />
                  ) : (
                    <Icon size={22} color={ink} />
                  )}
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 42,
                      backgroundColor: complete ? "#AECDB6" : "#E9E7EA",
                      marginVertical: 5,
                    }}
                  />
                )}
              </View>
              <View
                style={{
                  flex: 1,
                  paddingTop: 2,
                  paddingBottom: index < 2 ? 28 : 0,
                }}
              >
                <Text size={15} weight="semibold">
                  {title}
                </Text>
                <Text
                  size={12}
                  color="#727E89"
                  style={{ marginTop: 5, lineHeight: 19 }}
                >
                  {detail}
                </Text>
                <Text
                  size={11}
                  weight="semibold"
                  color={ink}
                  style={{ marginTop: 8 }}
                >
                  {complete
                    ? "Complete"
                    : current
                      ? "Awaiting staff"
                      : "Waiting"}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
      <Card style={{ marginTop: 18 }}>
        <View style={s.row}>
          <Avatar
            initials={guardian.name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          />
          <View style={{ flex: 1 }}>
            <Text size={11} color="#727E89">
              PICKUP GUARDIAN
            </Text>
            <Text weight="semibold" style={{ marginTop: 4 }}>
              {guardian.name}
            </Text>
            <Text size={12} color="#727E89" style={{ marginTop: 3 }}>
              {guardian.relationship || "Guardian"}
            </Text>
          </View>
        </View>
      </Card>
      <Notice>
        {guardian.pickup_authorized
          ? "Authorized staff complete verification and check-out at the front desk."
          : "This guardian must be approved by daycare staff before pickup."}
      </Notice>
    </Page>
  );
}
