<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  OsBadge,
  OsButton,
  OsCheckbox,
  OsDialog,
  OsDrawer,
  OsEmpty,
  OsForm,
  OsInput,
  OsPagination,
  OsRadio,
  OsSelect,
  OsSkeleton,
  OsSwitch,
  OsTable,
  OsTabs,
  OsTooltip,
  OsTrafficLights,
  type FormField,
  type RadioOption,
  type Size,
  type Status,
  type TableColumn,
} from '@/ui'
import { useNotification } from '@/kernel/stores/notification'
import CrashProbe from './CrashProbe.vue'

const { t } = useI18n()
const notif = useNotification()
const tab = ref('basic')
const crash = ref(false)
const tabs = computed(() => [
  { key: 'basic', label: t('gallery.tabs.basic') },
  { key: 'input', label: t('gallery.tabs.input') },
  { key: 'display', label: t('gallery.tabs.display') },
  { key: 'feedback', label: t('gallery.tabs.feedback') },
])

// 通用约定：四条契约在同一块里横向铺开，档位/状态名直接用 props 字面量
const sizes: Size[] = ['sm', 'md', 'lg']
const statuses: Status[] = ['default', 'error', 'warning']
const sizeInputVal = ref('')
const sizeSelectVal = ref('')
const statusCheck = ref(true)
const statusSwitch = ref(true)
const busyDialog = ref(false)
const busy = ref(false)
function runBusy() {
  busy.value = true
  setTimeout(() => {
    busy.value = false
    busyDialog.value = false
  }, 800)
}

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
const radioOptions: RadioOption[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
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
      <section class="rounded-surface border border-line bg-surface p-md">
        <h3 class="text-title font-strong text-ink">{{ t('gallery.conventions') }}</h3>
        <p class="mt-2xs text-caption text-ink-mute">{{ t('gallery.conventionsHint') }}</p>

        <div class="mt-sm grid grid-cols-1 gap-md xl:grid-cols-2">
          <div>
            <h4 class="text-ui font-strong text-ink">{{ t('gallery.conventionSize') }}</h4>
            <p class="mt-2xs text-micro text-ink-mute">{{ t('gallery.conventionSizeHint') }}</p>
            <div class="mt-xs flex flex-col gap-xs">
              <div class="flex flex-wrap items-center gap-xs">
                <OsButton v-for="s in sizes" :key="s" :size="s" variant="primary">{{ s }}</OsButton>
              </div>
              <div class="flex flex-wrap items-center gap-xs">
                <OsInput
                  v-for="s in sizes"
                  :key="s"
                  v-model="sizeInputVal"
                  :size="s"
                  :placeholder="s"
                  class="w-32"
                />
              </div>
              <div class="flex flex-wrap items-center gap-xs">
                <OsSelect
                  v-for="s in sizes"
                  :key="s"
                  v-model="sizeSelectVal"
                  :size="s"
                  :options="selectOptions"
                  class="w-32"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 class="text-ui font-strong text-ink">{{ t('gallery.conventionStatus') }}</h4>
            <p class="mt-2xs text-micro text-ink-mute">{{ t('gallery.conventionStatusHint') }}</p>
            <div class="mt-xs flex flex-col gap-xs">
              <div class="flex flex-wrap items-center gap-xs">
                <OsInput
                  v-for="s in statuses"
                  :key="s"
                  v-model="sizeInputVal"
                  :status="s"
                  :placeholder="s"
                  class="w-32"
                />
              </div>
              <div class="flex flex-wrap items-center gap-xs">
                <OsSelect
                  v-for="s in statuses"
                  :key="s"
                  v-model="sizeSelectVal"
                  :status="s"
                  :options="selectOptions"
                  class="w-32"
                />
              </div>
              <div class="flex flex-wrap items-center gap-sm">
                <OsCheckbox
                  v-for="s in statuses"
                  :key="s"
                  v-model="statusCheck"
                  :status="s"
                  :label="s"
                />
                <OsSwitch
                  v-for="s in statuses"
                  :key="s"
                  v-model="statusSwitch"
                  :status="s"
                  :label="s"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 class="text-ui font-strong text-ink">{{ t('gallery.conventionDisabled') }}</h4>
            <p class="mt-2xs text-micro text-ink-mute">
              {{ t('gallery.conventionDisabledHint') }}
            </p>
            <div class="mt-xs flex flex-wrap items-center gap-sm">
              <OsButton disabled>{{ t('gallery.disabled') }}</OsButton>
              <OsInput v-model="sizeInputVal" disabled class="w-32" />
              <OsSelect v-model="sizeSelectVal" :options="selectOptions" disabled class="w-32" />
              <OsCheckbox v-model="checkVal" disabled :label="t('gallery.checkbox')" />
              <OsSwitch v-model="switchVal" disabled :label="t('gallery.switch')" />
              <OsRadio v-model="radioVal" :options="radioOptions" name="c-radio" disabled />
            </div>
          </div>

          <div>
            <h4 class="text-ui font-strong text-ink">{{ t('gallery.conventionLoading') }}</h4>
            <p class="mt-2xs text-micro text-ink-mute">
              {{ t('gallery.conventionLoadingHint') }}
            </p>
            <div class="mt-xs flex flex-col gap-xs">
              <div class="flex flex-wrap items-center gap-xs">
                <OsButton variant="primary" loading>{{ t('gallery.primary') }}</OsButton>
                <OsButton variant="primary">{{ t('gallery.primary') }}</OsButton>
              </div>
              <div class="flex flex-wrap items-center gap-xs">
                <OsSelect v-model="sizeSelectVal" :options="selectOptions" loading class="w-32" />
                <OsButton size="sm" @click="busyDialog = true">
                  {{ t('gallery.conventionDialogTrigger') }}
                </OsButton>
              </div>
            </div>
          </div>
        </div>

        <OsDialog
          v-if="busyDialog"
          :title="t('gallery.dialogTitle')"
          :loading="busy"
          @confirm="runBusy"
          @cancel="busyDialog = false"
        >
          <p class="text-ui text-ink">{{ t('gallery.conventionLoadingHint') }}</p>
        </OsDialog>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsButton</h3>
        <div class="flex flex-wrap items-center gap-2">
          <OsButton variant="primary">{{ t('gallery.primary') }}</OsButton>
          <OsButton>{{ t('gallery.secondary') }}</OsButton>
          <OsButton variant="danger">{{ t('gallery.danger') }}</OsButton>
          <OsButton size="sm">{{ t('gallery.small') }}</OsButton>
          <OsButton disabled>{{ t('gallery.disabled') }}</OsButton>
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsInput</h3>
        <OsInput
          v-model="text"
          :placeholder="t('gallery.inputPlaceholder')"
          clearable
          class="max-w-60"
        />
        <p class="mt-1 text-caption text-ink-mute">
          {{ t('gallery.currentValue', { v: text || t('gallery.emptyValue') }) }}
        </p>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsBadge / OsTrafficLights</h3>
        <div class="flex items-center gap-4">
          <span class="inline-flex items-center gap-1"
            >{{ t('gallery.badgeNotice') }} <OsBadge :count="5"
          /></span>
          <span class="inline-flex items-center gap-1"
            >{{ t('gallery.badgeMessage') }} <OsBadge :count="12"
          /></span>
          <span class="inline-flex items-center gap-2xs">
            <OsBadge dot status="success" />
            {{ t('gallery.badgeNotice') }}
          </span>
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
        <OsRadio v-model="radioVal" :options="radioOptions" name="demo-radio" />
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">{{ t('gallery.formTitle') }}</h3>
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
          <h3 class="text-title font-strong text-ink">OsTable</h3>
          <OsButton size="sm" @click="reload">{{ t('gallery.simulateLoad') }}</OsButton>
          <OsTooltip :text="t('gallery.hoverTipText')">
            <OsButton size="sm">{{ t('gallery.hoverTip') }}</OsButton>
          </OsTooltip>
          <span class="text-caption text-ink-mute">{{
            t('gallery.selectedRows', { n: selected.length })
          }}</span>
        </div>
        <div class="h-56 rounded-surface border border-line">
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
              <span
                class="rounded-chip bg-accent-soft px-2 py-2xs text-caption text-accent-strong"
                >{{ value }}</span
              >
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
          <h3 class="mb-2 text-title font-strong text-ink">OsEmpty</h3>
          <OsEmpty :description="t('gallery.emptyText')" />
        </div>
        <div>
          <h3 class="mb-2 text-title font-strong text-ink">OsSkeleton</h3>
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
        <OsButton variant="danger" @click="crash = true">
          {{ t('gallery.triggerCrash') }}
        </OsButton>
      </div>
      <CrashProbe :when="crash" />
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
