<script setup lang="ts">
import { ref } from 'vue'
import OsBadge from '@/ui/OsBadge.vue'
import OsButton from '@/ui/OsButton.vue'
import OsCheckbox from '@/ui/OsCheckbox.vue'
import OsDialog from '@/ui/OsDialog.vue'
import OsDrawer from '@/ui/OsDrawer.vue'
import OsEmpty from '@/ui/OsEmpty.vue'
import OsForm, { type FormField } from '@/ui/OsForm.vue'
import OsInput from '@/ui/OsInput.vue'
import OsPagination from '@/ui/OsPagination.vue'
import OsRadio from '@/ui/OsRadio.vue'
import OsSelect from '@/ui/OsSelect.vue'
import OsSkeleton from '@/ui/OsSkeleton.vue'
import OsSwitch from '@/ui/OsSwitch.vue'
import OsTable, { type TableColumn } from '@/ui/OsTable.vue'
import OsTabs from '@/ui/OsTabs.vue'
import OsTooltip from '@/ui/OsTooltip.vue'
import OsTrafficLights from '@/ui/OsTrafficLights.vue'
import { useNotification } from '@/kernel/stores/notification'

const notif = useNotification()
const tab = ref('basic')
const tabs = [
  { key: 'basic', label: '基础' },
  { key: 'input', label: '录入' },
  { key: 'display', label: '展示' },
  { key: 'feedback', label: '反馈' },
]

// 录入
const text = ref('')
const selectVal = ref('')
const switchVal = ref(true)
const checkVal = ref(false)
const radioVal = ref('a')
const selectOptions = [
  { value: 'vue', label: 'Vue' },
  { value: 'react', label: 'React' },
  { value: 'svelte', label: 'Svelte' },
]

// 表单
const formModel = ref<Record<string, unknown>>({ name: '', framework: '', agree: false })
const formFields: FormField[] = [
  {
    key: 'name',
    label: '名称',
    type: 'input',
    required: true,
    min: 2,
    placeholder: '至少 2 个字符',
  },
  { key: 'framework', label: '框架', type: 'select', options: selectOptions, required: true },
  {
    key: 'agree',
    label: '我已阅读并同意条款',
    type: 'checkbox',
    required: true,
    message: '请先同意条款',
  },
]
function onFormSubmit(values: Record<string, unknown>) {
  notif.push('表单已提交', JSON.stringify(values))
}

// 表格
interface Row extends Record<string, unknown> {
  id: number
  name: string
  role: string
  age: number
}
const columns: TableColumn<Row>[] = [
  { key: 'name', title: '姓名', sortable: true },
  { key: 'role', title: '角色', slot: 'role' },
  { key: 'age', title: '年龄', sortable: true, align: 'right' },
]
const rows = ref<Row[]>([
  { id: 1, name: '张三', role: 'admin', age: 28 },
  { id: 2, name: '李四', role: 'editor', age: 34 },
  { id: 3, name: '王五', role: 'viewer', age: 22 },
])
const selected = ref<(string | number)[]>([])
const loading = ref(false)
const page = ref(1)
function reload() {
  loading.value = true
  setTimeout(() => (loading.value = false), 700)
}

// 反馈
const dialogOpen = ref(false)
const drawerOpen = ref(false)
</script>

<template>
  <OsTabs v-model="tab" :tabs="tabs" class="h-full">
    <!-- 基础 -->
    <div v-if="tab === 'basic'" class="space-y-5 p-4">
      <section>
        <h3 class="mb-2 text-title font-medium text-ink">OsButton</h3>
        <div class="flex flex-wrap items-center gap-2">
          <OsButton variant="primary">主要</OsButton>
          <OsButton>次要</OsButton>
          <OsButton variant="danger">危险</OsButton>
          <OsButton size="sm">小尺寸</OsButton>
          <OsButton disabled>禁用</OsButton>
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-title font-medium text-ink">OsInput</h3>
        <OsInput v-model="text" placeholder="输入点什么…" class="max-w-60" />
        <p class="mt-1 text-caption text-ink-mute">当前值：{{ text || '（空）' }}</p>
      </section>
      <section>
        <h3 class="mb-2 text-title font-medium text-ink">OsBadge / OsTrafficLights</h3>
        <div class="flex items-center gap-4">
          <span class="inline-flex items-center gap-1">通知 <OsBadge :count="5" /></span>
          <span class="inline-flex items-center gap-1">消息 <OsBadge :count="12" /></span>
          <OsTrafficLights />
        </div>
      </section>
    </div>

    <!-- 录入 -->
    <div v-else-if="tab === 'input'" class="space-y-5 p-4">
      <section class="flex flex-wrap items-center gap-6">
        <OsSelect v-model="selectVal" :options="selectOptions" class="w-40" />
        <OsSwitch v-model="switchVal" label="开关" />
        <OsCheckbox v-model="checkVal" label="复选" />
        <OsRadio
          v-model="radioVal"
          :options="[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]"
          name="demo-radio"
        />
      </section>
      <section>
        <h3 class="mb-2 text-title font-medium text-ink">OsForm（schema 驱动 + 校验）</h3>
        <OsForm
          v-model="formModel"
          :fields="formFields"
          layout="horizontal"
          @submit="onFormSubmit"
        />
      </section>
    </div>

    <!-- 展示 -->
    <div v-else-if="tab === 'display'" class="space-y-5 p-4">
      <section>
        <div class="mb-2 flex items-center gap-2">
          <h3 class="text-title font-medium text-ink">OsTable</h3>
          <OsButton size="sm" @click="reload">模拟加载</OsButton>
          <OsTooltip text="刷新表格数据"><OsButton size="sm">悬停提示</OsButton></OsTooltip>
          <span class="text-caption text-ink-mute">已选 {{ selected.length }} 行</span>
        </div>
        <div class="h-56 rounded-lg border border-slate-200">
          <OsTable
            v-model:selected="selected"
            v-model:page="page"
            :columns="columns"
            :rows="rows"
            :loading="loading"
            selectable
            :total="3"
            :page-size="10"
          >
            <template #role="{ value }">
              <span class="rounded bg-accent-soft px-2 py-0.5 text-caption text-accent-strong">{{
                value
              }}</span>
            </template>
            <template #actions="{ row }">
              <OsButton
                size="sm"
                variant="danger"
                @click="rows = rows.filter((r) => r.id !== row.id)"
              >
                删除
              </OsButton>
            </template>
          </OsTable>
        </div>
      </section>
      <section class="flex items-center gap-4">
        <OsPagination v-model="page" :total="45" :page-size="10" />
      </section>
      <section class="grid grid-cols-2 gap-4">
        <div>
          <h3 class="mb-2 text-title font-medium text-ink">OsEmpty</h3>
          <OsEmpty description="这里空空如也" />
        </div>
        <div>
          <h3 class="mb-2 text-title font-medium text-ink">OsSkeleton</h3>
          <OsSkeleton :rows="4" />
        </div>
      </section>
    </div>

    <!-- 反馈 -->
    <div v-else class="space-y-5 p-4">
      <div class="flex flex-wrap gap-2">
        <OsButton variant="primary" @click="dialogOpen = true">打开 Dialog</OsButton>
        <OsButton @click="drawerOpen = true">打开 Drawer</OsButton>
        <OsButton @click="notif.push('吐司提示', '这条来自 notification store')"
          >触发 Toast</OsButton
        >
      </div>
      <p class="text-caption text-ink-mute">
        Dialog / Drawer / Toast 均以 token 派生样式呈现；Toast 复用通知中心状态，不另起一套。
      </p>

      <OsDialog
        v-if="dialogOpen"
        title="确认操作"
        @confirm="dialogOpen = false"
        @cancel="dialogOpen = false"
      >
        <p class="text-ui text-ink">这是一个 OsDialog 示例，点击确定或取消关闭。</p>
      </OsDialog>

      <OsDrawer v-model="drawerOpen" title="抽屉标题">
        <p>这是 OsDrawer 内容区，可放置详情、表单或长列表。</p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <OsButton size="sm" @click="drawerOpen = false">关闭</OsButton>
            <OsButton size="sm" variant="primary" @click="drawerOpen = false">保存</OsButton>
          </div>
        </template>
      </OsDrawer>
    </div>
  </OsTabs>
</template>
