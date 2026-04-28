// MinutesViewer.tsx
import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Tag, 
  Collapse, 
  Typography, 
  List,
  Descriptions,
  Alert,
  Spin,
  Tabs
} from 'antd';
import { 
  FileTextOutlined, 
  UserOutlined, 
  BookOutlined, 
  CheckCircleOutlined,
  WarningOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { parseWordDocument, ParsedMinutes, MinuteEntry } from './minutesParser';

const { Panel } = Collapse;
const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

interface MinutesViewerProps {
  file: File;
  onParseComplete?: (minutes: ParsedMinutes) => void;
}

const MinutesViewer: React.FC<MinutesViewerProps> = ({ file, onParseComplete }) => {
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedMinutes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await parseWordDocument(file);
      setParsedData(result);
      onParseComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document');
    } finally {
      setLoading(false);
    }
  };

  const copyMinuteToClipboard = (minute: MinuteEntry) => {
    const text = `Minute ${minute.minuteNumber}: ${minute.title}\n\n${minute.proceedings}\n\nAction Items:\n${minute.actionItems.join('\n')}`;
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Parsing document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert 
        message="Parse Error" 
        description={error} 
        type="error" 
        showIcon 
      />
    );
  }

  if (!parsedData) {
    return (
      <Card>
        <Button 
          type="primary" 
          size="large" 
          icon={<FileTextOutlined />}
          onClick={handleParse}
          block
        >
          Parse Minutes from Document
        </Button>
      </Card>
    );
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <Tabs defaultActiveKey="minutes">
        <TabPane tab={`📋 Minutes (${parsedData.minutes.length})`} key="minutes">
          <Collapse accordion>
            {parsedData.minutes.map((minute, idx) => (
              <Panel
                key={minute.id}
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <strong>Minute {minute.minuteNumber}</strong>
                      <span>|</span>
                      <span>{minute.title}</span>
                    </Space>
                    <Space>
                      {minute.actionItems.length > 0 && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          {minute.actionItems.length} Action Items
                        </Tag>
                      )}
                      {minute.allToNote && (
                        <Tag color="orange" icon={<WarningOutlined />}>
                          ALL TO NOTE
                        </Tag>
                      )}
                    </Space>
                  </div>
                }
                extra={
                  <Button 
                    size="small" 
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyMinuteToClipboard(minute);
                    }}
                  >
                    Copy
                  </Button>
                }
              >
                <div style={{ paddingLeft: 16 }}>
                  <Title level={5}>Proceedings:</Title>
                  <Paragraph>
                    {minute.proceedings.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))}
                  </Paragraph>
                  
                  {minute.actionItems.length > 0 && (
                    <>
                      <Title level={5}>Action Items:</Title>
                      <List
                        size="small"
                        dataSource={minute.actionItems}
                        renderItem={(item) => (
                          <List.Item>
                            <Text code>→</Text> {item}
                          </List.Item>
                        )}
                      />
                    </>
                  )}
                </div>
              </Panel>
            ))}
          </Collapse>
        </TabPane>

        <TabPane tab="📊 Meeting Info" key="info">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Subject">{parsedData.meetingInfo.subject || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Date">{parsedData.meetingInfo.date || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Time">{parsedData.meetingInfo.time || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Location">{parsedData.meetingInfo.location || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Recorded By">{parsedData.meetingInfo.recordedBy || 'N/A'}</Descriptions.Item>
          </Descriptions>
        </TabPane>

        <TabPane tab="👥 Attendees" key="attendees">
          <List
            dataSource={parsedData.attendees}
            renderItem={(attendee) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<UserOutlined />}
                  title={attendee.name}
                  description={`${attendee.designation || ''} ${attendee.organization || ''}`}
                />
              </List.Item>
            )}
          />
        </TabPane>

        <TabPane tab="📋 Agenda" key="agenda">
          <List
            dataSource={parsedData.agenda}
            renderItem={(item, idx) => (
              <List.Item>
                <Text>{idx + 1}. {item}</Text>
              </List.Item>
            )}
          />
        </TabPane>

        <TabPane tab="✅ Resolutions" key="resolutions">
          <List
            dataSource={parsedData.resolutions}
            renderItem={(item, idx) => (
              <List.Item>
                <Text>• {item}</Text>
              </List.Item>
            )}
          />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default MinutesViewer;