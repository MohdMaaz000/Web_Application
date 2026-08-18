const http = require("http");

const mockMessagesCreate = jest.fn();

jest.mock("twilio", () => jest.fn(() => ({
  messages: {
    create: mockMessagesCreate
  }
})));

const makeRequest = (server, body) => new Promise((resolve, reject) => {
  const address = server.address();
  const request = http.request({
    hostname: "127.0.0.1",
    port: address.port,
    path: "/api/notify",
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  }, (response) => {
    let data = "";

    response.on("data", (chunk) => {
      data += chunk;
    });

    response.on("end", () => {
      resolve({
        status: response.statusCode,
        body: JSON.parse(data)
      });
    });
  });

  request.on("error", reject);
  request.write(JSON.stringify(body));
  request.end();
});

describe("Notification API", () => {
  let app;
  let server;

  const baseEnv = {
    TWILIO_ACCOUNT_SID: "test-account-sid",
    TWILIO_AUTH_TOKEN: "test-auth-token"
  };

  beforeEach(() => {
    jest.resetModules();
    mockMessagesCreate.mockReset();
    process.env = {
      ...process.env,
      ...baseEnv,
      TWILIO_FROM_NUMBER: "+971500000000",
      TWILIO_WHATSAPP_FROM: "+971500000001"
    };
    app = require("./server.js");
    server = app.listen(0);
  });

  afterEach((done) => {
    server.close(done);
  });

  test("returns 501 when TWILIO_FROM_NUMBER is missing for SMS", async () => {
    server.close();
    delete process.env.TWILIO_FROM_NUMBER;
    jest.resetModules();
    app = require("./server.js");
    server = app.listen(0);

    const response = await makeRequest(server, {
      name: "Test Customer",
      phone: "+971501234567",
      message: "Test SMS",
      type: "sms"
    });

    expect(response.status).toBe(501);
    expect(response.body).toEqual({
      error: "TWILIO_FROM_NUMBER is required for SMS messages."
    });
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  test("sends SMS when TWILIO_FROM_NUMBER is configured", async () => {
    mockMessagesCreate.mockResolvedValue({ sid: "SM-test" });

    const response = await makeRequest(server, {
      name: "Test Customer",
      phone: "+971501234567",
      message: "Test SMS",
      type: "sms"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, sid: "SM-test" });
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      body: "Test SMS",
      from: "+971500000000",
      to: "+971501234567"
    });
  });

  test("returns 400 for invalid notification requests", async () => {
    const response = await makeRequest(server, {
      name: "Test Customer",
      phone: "+971501234567",
      type: "sms"
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "name, phone and message are required"
    });
  });
});
