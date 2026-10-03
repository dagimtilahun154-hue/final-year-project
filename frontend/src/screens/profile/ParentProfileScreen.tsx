import React, { useState } from "react";
import { User, Phone, EnvelopeSimple } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Field,
  Button,
  Notice,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useAuth } from "../../context/AuthContext";
import { contactError } from "../../utils/contact";
export function ParentProfileScreen() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "Hana Tesfaye");
  const [phone, setPhone] = useState(user?.phone || "+251 91 123 4567");
  const [email, setEmail] = useState(user?.email || "hana.tesfaye@example.com");
  const [message, setMessage] = useState("");
  return (
    <Page title="Personal Information" back tabs activeTab="Profile">
      <Card style={{ alignItems: "center", marginBottom: 24 }}>
        <Avatar source={artwork.mother} size={88} />
        <Text size={23} weight="semibold" style={{ marginTop: 16 }}>
          {name}
        </Text>
        <Text size={13} color="#88909B">
          Liya’s mother
        </Text>
      </Card>
      <Card>
        <Field
          label="Full Name"
          icon={User}
          value={name}
          onChangeText={setName}
        />
        <Field
          label="Phone Number"
          icon={Phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Field
          label="Email Address"
          icon={EnvelopeSimple}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Card>
      {message ? <Notice>{message}</Notice> : null}
      <Button
        title="Preview Changes"
        onPress={() =>
          setMessage(
            contactError(name, phone, email, true) ||
              "Draft ready. Account changes have not been submitted.",
          )
        }
        style={{ marginTop: 28 }}
      />
    </Page>
  );
}
