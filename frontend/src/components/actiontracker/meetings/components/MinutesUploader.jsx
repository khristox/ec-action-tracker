// components/MinutesUploader.jsx
import React, { useState } from 'react';
import { Upload, Button, Table, Form, Input, Card, Tabs, message } from 'antd';
import { InboxOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { TabPane } = Tabs;

export default function MinutesUploader() {
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const uploadProps = {
    name: 'file',
    accept: '.pdf,.docx',
    beforeUpload: (file) => {
      const isValidType = file.type === 'application/pdf' || 
                          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (!isValidType) {
        message.error('Only PDF or DOCX files allowed!');
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/v1/meeting-minutes/extract', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        if (result.success) {
          setExtractedData(result.data);
          form.setFieldsValue(result.data);
          onSuccess();
          message.success('Minutes extracted successfully!');
        } else {
          onError();
          message.error('Extraction failed');
        }
      } catch (error) {
        onError();
        message.error('Error processing file');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConfirm = async () => {
    const values = await form.validateFields();
    const response = await fetch('/api/v1/meeting-minutes/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    if (response.ok) {
      message.success('Minutes saved successfully!');
      setExtractedData(null);
      form.resetFields();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Dragger {...uploadProps} disabled={loading}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or drag meeting minutes file here</p>
        <p className="ant-upload-hint">Support: PDF, DOCX</p>
      </Dragger>

      {extractedData && (
        <Card style={{ marginTop: '24px' }}>
          <Tabs>
            <TabPane tab="Meeting Info" key="info">
              <Form form={form} layout="vertical">
                <Form.Item name={['meeting_info', 'date']} label="Date" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name={['meeting_info', 'time']} label="Time">
                  <Input />
                </Form.Item>
                <Form.Item name={['meeting_info', 'location']} label="Location">
                  <Input />
                </Form.Item>
              </Form>
            </TabPane>

            <TabPane tab="Attendees" key="attendees">
              <Table
                dataSource={extractedData.attendees}
                columns={[
                  { title: 'Name', dataIndex: 'name', editable: true },
                  { title: 'Designation', dataIndex: 'designation', editable: true },
                  { title: 'Organization', dataIndex: 'organization', editable: true },
                  { title: 'Telephone', dataIndex: 'telephone', editable: true }
                ]}
                rowKey="name"
                pagination={false}
              />
            </TabPane>

            <TabPane tab="Minutes" key="minutes">
              {extractedData.minutes?.map((minute, idx) => (
                <Card key={idx} size="small" style={{ marginBottom: '8px' }}>
                  <Form.Item name={['minutes', idx, 'minute_no']} label="Minute No.">
                    <Input defaultValue={minute.minute_no} />
                  </Form.Item>
                  <Form.Item name={['minutes', idx, 'proceeding']} label="Proceedings">
                    <Input.TextArea rows={3} defaultValue={minute.proceeding} />
                  </Form.Item>
                  <Form.Item name={['minutes', idx, 'action']} label="Action">
                    <Input defaultValue={minute.action} />
                  </Form.Item>
                </Card>
              ))}
            </TabPane>

            <TabPane tab="Resolutions" key="resolutions">
              {extractedData.resolutions?.map((res, idx) => (
                <Form.Item key={idx} name={['resolutions', idx]}>
                  <Input.TextArea rows={2} defaultValue={res} />
                </Form.Item>
              ))}
            </TabPane>
          </Tabs>

          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />}
            onClick={handleConfirm}
            style={{ marginTop: '16px' }}
          >
            Confirm & Save Minutes
          </Button>
        </Card>
      )}
    </div>
  );
}