import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Input, Button, Form, App, Alert } from 'antd';

const { TextArea } = Input;

// 默认配置
const DEFAULT_CONFIG = {
    vendor: {
        role: "资深销售策略顾问（售前专家）",
        goal: "帮助乙方团队赢得订单，优化投资回报率，影响关键决策人。",
        tone: "战略性、鼓励性、有洞察力、行动导向。"
    },
    client: {
        role: "政府项目审计官（PMO / 监管部门）",
        goal: "确保合规性、预算安全和交付质量，最小化风险。",
        tone: "客观、批判性、风险规避、正式。"
    }
};

export default function AiPersonaConfigModal({
    isOpen,
    onClose,
    onSave,
    initialConfig = {}
}) {
    const [activeTab, setActiveTab] = useState('vendor');
    const [form] = Form.useForm();

    // 合并初始配置与默认配置
    const [config, setConfig] = useState({
        vendor: { ...DEFAULT_CONFIG.vendor, ...initialConfig.vendor },
        client: { ...DEFAULT_CONFIG.client, ...initialConfig.client }
    });

    // 当 activeTab 改变时，重置表单值
    useEffect(() => {
        if (isOpen) {
            form.setFieldsValue(config[activeTab]);
        }
    }, [activeTab, isOpen, config, form]);

    const handleValuesChange = (_, allValues) => {
        setConfig(prev => ({
            ...prev,
            [activeTab]: { ...prev[activeTab], ...allValues }
        }));
    };

    const handleSave = () => {
        onSave(config);
        onClose();
    };

    const handleReset = () => {
        const newConfig = {
            ...config,
            [activeTab]: { ...DEFAULT_CONFIG[activeTab] }
        };
        setConfig(newConfig);
        form.setFieldsValue(DEFAULT_CONFIG[activeTab]);
    };

    const items = [
        {
            key: 'vendor',
            label: (
                <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    乙方 (销售/顾问)
                </span>
            ),
        },
        {
            key: 'client',
            label: (
                <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    甲方 (审计/监管)
                </span>
            ),
        },
    ];

    return (
        <Modal
            title="AI 人设思维配置"
            open={isOpen}
            onCancel={onClose}
            onOk={handleSave}
            okText="保存配置"
            cancelText="取消"
            width={600}
            zIndex={1001} // 确保在 Sidebar 之上
            styles={{
                content: { paddingTop: 0 },
                header: { marginBottom: 16, paddingTop: 20 }
            }}
        >
            <Alert
                message="叙事引擎 (Narrative Engine) 已激活"
                description="在此配置 AI 的深层思维模式。这些设置将直接决定 Narrative Engine 生成的卡片逻辑和话术风格。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={items}
                type="card"
                style={{ marginBottom: 16 }}
            />

            <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
                initialValues={config[activeTab]}
            >
                <Form.Item
                    label="角色定义 (Role)"
                    name="role"
                    tooltip="AI 的身份设定，决定了它的视角和权限。"
                >
                    <TextArea rows={2} placeholder="例如：资深售前顾问..." />
                </Form.Item>

                <Form.Item
                    label="核心目标 (Goal)"
                    name="goal"
                    tooltip="AI 在对话中试图达成的最终目的。"
                >
                    <TextArea rows={2} placeholder="例如：赢得订单、控制风险..." />
                </Form.Item>

                <Form.Item
                    label="语气风格 (Tone)"
                    name="tone"
                    tooltip="AI 说话的口吻，如激进、保守、鼓励等。"
                >
                    <Input placeholder="例如：专业、严厉、幽默..." />
                </Form.Item>
            </Form>

            <div className="flex justify-end">
                <Button type="link" onClick={handleReset} size="small" className="text-zinc-500">
                    恢复默认模板
                </Button>
            </div>
        </Modal>
    );
}
