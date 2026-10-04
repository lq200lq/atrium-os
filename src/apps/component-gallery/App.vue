<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
const notif = useNotification()
const tab = ref('basic')
const tabs = computed(() => [
  { key: 'basic', label: t('gallery.tabs.basic') },
  { key: 'input', label: t('gallery.tabs.input') },
  { key: 'display', label: t('gallery.tabs.display') },
  { key: 'feedback', label: t('gallery.tabs.feedback') },
])

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
const formFields = computed<FormField[]>(() => [
  {
    key: 'name',
    label: t('gallery.fieldName'),
    type: 'input',
    required: true,
    min: 2,
    placeholder: t('gallery.namePlaceholder'),
  },
  {
    key: 'framework',
    label: t('gallery.fieldFramework'),
    type: 'select',
    options: selectOptions,
    required: true,
  },
  {
    key: 'agree',
    label: t('gallery.agree'),
    type: 'checkbox',
    required: true,
    message: t('gallery.agreeMsg'),
  },
])
function onFormSubmit(values: Record<string, unknown>) {
  notif.push(t('gallery.formSubmitted'), JSON.stringify(values))
}

// 表格
interface Row extends Record<string, unknown> {
  id: number
  name: string
  role: string
  age: number
}
const columns = computed<TableColumn<Row>[]>(() => [
  { key: 'name', title: t('gallery.tableName'), sortable: true },
  { key: 'role', title: t('gallery.tableRole'), slot: 'role' },
  { key: 'age', title: t('gallery.tableAge'), sortable: true, align: 'right' },
])
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
          <OsButton variant="primary">{{ t('gallery.primary') }}</OsButton>
          <OsButton>{{ t('gallery.secondary') }}</OsButton>
          <OsButton variant="danger">{{ t('gallery.danger') }}</OsButton>
          <OsButton size="sm">{{ t('gallery.small') }}</OsButton>
          <OsButton disabled>{{ t('gallery.disabled') }}</OsButton>
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-title font-medium text-ink">OsInput</h3>
        <OsInput v-model="text" :placeholder="t('gallery.inputPlaceholder')" class="max-w-60" />
        <p class="mt-1 text-caption text-ink-mute">
          {{ t('gallery.currentValue', { v: text || t('gallery.emptyValue') }) }}
        </p>
      </section>
      <section>
        <h3 class="mb-2 text-title font-medium text-ink">OsBadge / OsTrafficLights</h3>
        <div class="flex items-center gap-4">
          <span class="inline-flex items-center gap-1"
            >{{ t('gallery.badgeNotice') }} <OsBadge :count="5"
          /></span>
          <span class="inline-flex items-center gap-1"
            >{{ t('gallery.badgeMessage') }} <OsBadge :count="12"
          /></span>
          <OsTrafficLights />
        </div>
      </section>
    </div>

    <!-- 录入 -->
    <div v-else-if="tab === 'input'" class="space-y-5 p-4">
      <section class="flex flex-wrap items-center gap-6">
        <OsSelect v-model="selectVal" :options="selectOptions" class="w-40" />
        <OsSwitch v-model="switchVal" :label="t('gallery.switch')" />
        <OsCheckbox v-model="checkVal" :label="t('gallery.checkbox')" />
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
        <h3 class="mb-2 text-title font-medium text-ink">{{ t('gallery.formTitle') }}</h3>
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
          <OsButton size="sm" @click="reload">{{ t('gallery.simulateLoad') }}</OsButton>
          <OsTooltip :text="t('gallery.hoverTipText')">
            <OsButton size="sm">{{ t('gallery.hoverTip') }}</OsButton>
          </OsTooltip>
          <span class="text-caption text-ink-mute">{{
            t('gallery.selectedRows', { n: selected.length })
          }}</span>
        </div>
        <div class="h-56 rounded-lg border border-line">
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
                {{ t('common.delete') }}
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
          <OsEmpty :description="t('gallery.emptyText')" />
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
        <OsButton variant="primary" @click="dialogOpen = true">
          {{ t('gallery.openDialog') }}
        </OsButton>
        <OsButton @click="drawerOpen = true">{{ t('gallery.openDrawer') }}</OsButton>
        <OsButton @click="notif.push(t('gallery.toastTitle'), t('gallery.toastBody'))">
          {{ t('gallery.triggerToast') }}
        </OsButton>
      </div>
      <p class="text-caption text-ink-mute">{{ t('gallery.feedbackHint') }}</p>

      <OsDialog
        v-if="dialogOpen"
        :title="t('gallery.dialogTitle')"
        @confirm="dialogOpen = false"
        @cancel="dialogOpen = false"
      >
        <p class="text-ui text-ink">{{ t('gallery.dialogBody') }}</p>
      </OsDialog>

      <OsDrawer v-model="drawerOpen" :title="t('gallery.drawerTitle')">
        <p>{{ t('gallery.drawerBody') }}</p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <OsButton size="sm" @click="drawerOpen = false">{{ t('common.close') }}</OsButton>
            <OsButton size="sm" variant="primary" @click="drawerOpen = false">
              {{ t('common.save') }}
            </OsButton>
          </div>
        </template>
      </OsDrawer>
    </div>
  </OsTabs>
</template>
