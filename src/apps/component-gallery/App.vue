<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  OsAlert,
  OsAvatar,
  OsBadge,
  OsBreadcrumb,
  OsButton,
  OsCard,
  OsCheckbox,
  OsCollapse,
  OsDescriptions,
  OsDialog,
  OsDivider,
  OsDrawer,
  OsDropdown,
  OsEmpty,
  OsForm,
  OsGrid,
  OsInput,
  OsInputNumber,
  OsMenu,
  OsPagination,
  OsPopconfirm,
  OsProgress,
  OsRadio,
  OsResult,
  OsSegmented,
  OsSelect,
  OsSkeleton,
  OsSpace,
  OsSpin,
  OsSteps,
  OsSwitch,
  OsTable,
  OsTabs,
  OsTag,
  OsTextarea,
  OsTooltip,
  OsTypography,
  OsTrafficLights,
  OsTree,
  type BreadcrumbItem,
  type CollapseItem,
  type DescriptionItem,
  type FormField,
  type MenuItem,
  type ProgressStatus,
  type RadioOption,
  type ResultStatus,
  type SegmentedOption,
  type Size,
  type Status,
  type StepItem,
  type TableColumn,
  type TreeNode,
} from '@/ui'
import { useNotification } from '@/kernel/stores/notification'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useFeedback } from '@/ui/feedback'
import CrashProbe from './CrashProbe.vue'

const { t } = useI18n()
const notif = useNotification()
const win = useWindowManager()
const feedback = useFeedback()
const tab = ref('basic')
const crash = ref(false)
const tabs = computed(() => [
  { key: 'basic', label: t('gallery.tabs.basic') },
  { key: 'input', label: t('gallery.tabs.input') },
  { key: 'layout', label: t('gallery.tabs.layout') },
  { key: 'display', label: t('gallery.tabs.display') },
  { key: 'nav', label: t('gallery.tabs.nav') },
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

// 反馈件（S10-A）
const alertVisible = ref(true)
const spinOverlay = ref(true)
const progressPct = ref(40)
const progressStatus = ref<ProgressStatus | undefined>(undefined)
function bumpProgress() {
  progressStatus.value = undefined
  progressPct.value = Math.min(100, progressPct.value + 10)
}
const resultStatus = ref<string>('success')
const resultStatusOptions = computed<SegmentedOption[]>(() => [
  { value: 'success', label: t('result.success.title') },
  { value: 'error', label: t('result.error.title') },
  { value: '403', label: t('result.forbidden.title') },
  { value: 'warning', label: t('result.warning.title') },
])

// 命令式确认与通知是同一条链：confirm 决议后用同一入口回写，不另设对话框状态
async function askFeedback() {
  const ok = await feedback.confirm({
    title: t('gallery.feedbackApiDialog'),
    content: t('gallery.feedbackApiConfirmDesc'),
  })
  if (ok) feedback.success(t('gallery.feedbackApiYes'))
  else feedback.info(t('gallery.feedbackApiNo'))
}

// 布局与展示（S9-A）
const collapseItems = computed<CollapseItem[]>(() => [
  { key: 'intro', header: t('gallery.collapseIntro') },
  { key: 'usage', header: t('gallery.collapseUsage') },
  { key: 'faq', header: t('gallery.collapseFaq') },
])
const descItems = computed<DescriptionItem[]>(() => [
  { key: 'name', label: t('gallery.descLabelName'), value: 'report.xlsx' },
  { key: 'path', label: t('gallery.descLabelPath'), value: '~/documents' },
  { key: 'size', label: t('gallery.descLabelSize'), value: '1.2 MB' },
  { key: 'updated', label: t('gallery.descLabelUpdated'), value: '2026-10-04' },
])
const segOptions = computed<SegmentedOption[]>(() => [
  { value: 'list', label: t('gallery.segList'), icon: 'boxes' },
  { value: 'board', label: t('gallery.segBoard'), icon: 'activity' },
  { value: 'grid', label: t('gallery.segGrid'), icon: 'puzzle' },
])
const segVal = ref('list')
const accordionOpen = ref(['intro'])
const tagClosable = ref(true)

// 录入补全与树（S9-B）
const numVal = ref<number | undefined>(42)
const numStepped = ref<number | undefined>(0)
const numPrecise = ref<number | undefined>(3.14)
const taVal = ref('')
const treeData: TreeNode[] = [
  {
    key: 'docs',
    label: '文档',
    children: [
      { key: 'docs-req', label: '需求文档.docx' },
      {
        key: 'docs-tech',
        label: '技术文档',
        children: [
          { key: 'docs-tech-arch', label: '架构说明.md' },
          { key: 'docs-tech-api', label: '接口约定.md' },
        ],
      },
    ],
  },
  {
    key: 'media',
    label: '素材',
    children: [
      { key: 'media-cover', label: '封面.png' },
      { key: 'media-archived', label: '已归档', disabled: true },
    ],
  },
]
const treeChecked = ref<string[]>(['docs-req'])
const treeExpanded = ref<string[]>(['docs'])
const lazyTreeData: TreeNode[] = [{ key: 'remote', label: '远程目录（展开即加载）' }]
const lazyExpanded = ref<string[]>([])
const lazySelected = ref<string[]>([])

function loadTreeChildren(node: TreeNode): Promise<TreeNode[]> {
  const depth = node.key.split('-').length
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        Array.from({ length: 2 }, (_, i) => ({
          key: `${node.key}-${i + 1}`,
          label: `${node.label}-${i + 1}`,
          isLeaf: depth >= 2,
        })),
      )
    }, 600)
  })
}

// 导航件（S10-B）
const navMenuSelected = ref<string[]>(['nav-new-doc'])
const verticalMenu = computed<MenuItem[]>(() => [
  {
    key: 'file',
    label: t('topbar.menus.file'),
    icon: 'folder',
    children: [
      { key: 'nav-new-dir', label: t('gallery.navNewDir'), icon: 'folder' },
      { key: 'nav-new-doc', label: t('gallery.navNewDoc'), icon: 'file-text' },
    ],
  },
  { key: 'edit', label: t('topbar.menus.edit'), icon: 'notebook-pen' },
  { key: 'view', label: t('topbar.menus.view'), icon: 'boxes' },
  { key: 'delete', label: t('common.delete'), icon: 'trash-2', danger: true },
  { key: 'share', label: t('gallery.navShareAction'), icon: 'shield', disabled: true },
])
const horizontalMenu = computed<MenuItem[]>(() => [
  {
    key: 'file',
    label: t('topbar.menus.file'),
    children: [
      { key: 'nav-new-dir', label: t('gallery.navNewDir') },
      { key: 'nav-new-doc', label: t('gallery.navNewDoc') },
    ],
  },
  { key: 'edit', label: t('topbar.menus.edit') },
  { key: 'window', label: t('topbar.menus.window') },
  { key: 'help', label: t('topbar.menus.help') },
])
const dropdownItems = computed<MenuItem[]>(() => [
  { key: 'nav-new-dir', label: t('gallery.navNewDir'), icon: 'folder' },
  { key: 'nav-new-doc', label: t('gallery.navNewDoc'), icon: 'file-text' },
  { key: 'settings', label: t('topbar.menus.app'), icon: 'settings' },
  { key: 'delete', label: t('common.delete'), icon: 'trash-2', danger: true },
])
const dropdownEcho = ref('')
function onNavDropdownClick(key: string) {
  dropdownEcho.value = dropdownItems.value.find((i) => i.key === key)?.label ?? key
}

const breadcrumbItems = computed<BreadcrumbItem[]>(() => [
  { key: 'work', label: t('gallery.bcWork'), icon: 'boxes' },
  { key: 'project', label: t('gallery.bcProject') },
  { key: 'archive', label: t('gallery.bcArchive') },
  { key: 'tech', label: t('gallery.bcTech') },
  { key: 'team', label: t('gallery.bcTeam') },
  { key: 'file', label: t('gallery.bcFile') },
])
const breadcrumbEcho = ref('')
function onBreadcrumbClick(item: BreadcrumbItem) {
  breadcrumbEcho.value = item.label
}

const stepCurrent = ref(1)
const stepError = ref(false)
const stepItems = computed<StepItem[]>(() => [
  { title: t('gallery.stepInfo'), description: t('gallery.stepDescInfo') },
  { title: t('gallery.stepUpload'), description: t('gallery.stepDescUpload') },
  { title: t('gallery.stepSubmit'), description: t('gallery.stepDescSubmit') },
])
function stepPrev() {
  stepCurrent.value = Math.max(0, stepCurrent.value - 1)
}
function stepNext() {
  stepCurrent.value = Math.min(stepItems.value.length - 1, stepCurrent.value + 1)
}
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
        <h3 class="mb-2 text-title font-strong text-ink">OsInputNumber</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.numberHint') }}</p>
        <OsSpace size="sm" align="center" wrap>
          <OsInputNumber v-model="numVal" class="w-32" />
          <OsInputNumber v-model="numStepped" :min="0" :max="100" :step="5" class="w-32" />
          <OsInputNumber v-model="numPrecise" :precision="2" :step="0.1" class="w-32" />
          <OsInputNumber v-model="numVal" disabled class="w-32" />
        </OsSpace>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsTextarea</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.textareaHint') }}</p>
        <div class="flex flex-wrap gap-lg">
          <div class="w-72">
            <OsTextarea
              v-model="taVal"
              autosize
              show-count
              :max-length="120"
              :placeholder="t('gallery.textareaPlaceholder')"
            />
          </div>
          <div class="w-72">
            <OsTextarea v-model="taVal" :rows="4" status="warning" />
          </div>
        </div>
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

    <!-- 布局 -->
    <div v-else-if="tab === 'layout'" class="space-y-5 p-4">
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsSpace</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.spaceHint') }}</p>
        <OsSpace size="md" align="center" wrap class="mb-sm">
          <OsButton size="sm">A</OsButton>
          <OsButton size="sm">B</OsButton>
          <OsButton size="sm">C</OsButton>
        </OsSpace>
        <OsSpace direction="column" size="2xs">
          <OsInput v-model="text" :placeholder="t('gallery.inputPlaceholder')" class="w-48" />
          <OsSelect v-model="selectVal" :options="selectOptions" class="w-48" />
        </OsSpace>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsDivider</h3>
        <OsDivider class="my-sm" />
        <OsDivider class="my-sm">{{ t('gallery.dividerWithText') }}</OsDivider>
        <div class="mt-sm flex items-center gap-sm">
          <OsButton size="sm">{{ t('gallery.secondary') }}</OsButton>
          <OsDivider vertical />
          <OsButton size="sm">{{ t('gallery.primary') }}</OsButton>
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsGrid</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.gridHint') }}</p>
        <OsGrid :columns="3" gap="sm">
          <div
            v-for="n in 6"
            :key="n"
            class="rounded-surface border border-line bg-surface p-sm text-ui text-ink"
          >
            {{ n }}
          </div>
        </OsGrid>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsCard</h3>
        <OsCard :title="t('gallery.cardTitle')">
          <template #extra>
            <OsButton size="sm">{{ t('gallery.manage') }}</OsButton>
          </template>
          <p class="text-ui text-ink">{{ t('gallery.cardBody') }}</p>
          <template #footer>
            <OsSpace size="xs">
              <OsTag status="info">{{ t('gallery.tagAlpha') }}</OsTag>
              <OsTag status="success">{{ t('gallery.tagBeta') }}</OsTag>
            </OsSpace>
          </template>
        </OsCard>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsCollapse</h3>
        <div class="flex flex-col gap-sm">
          <OsCollapse :items="collapseItems">
            <template #panel-intro>
              <p class="text-ink">{{ t('gallery.collapseBody') }}</p>
            </template>
            <template #panel-usage>
              <p class="text-ink">v-model:items / panel-&lt;key&gt;</p>
            </template>
            <template #panel-faq>
              <p class="text-ink">{{ t('gallery.collapseBody') }}</p>
            </template>
          </OsCollapse>
          <OsCollapse v-model="accordionOpen" :items="collapseItems" accordion />
        </div>
      </section>
    </div>

    <!-- 展示 -->
    <div v-else-if="tab === 'display'" class="space-y-5 p-4">
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsTypography</h3>
        <div class="flex max-w-lg flex-col gap-xs">
          <OsTypography type="title">{{ t('gallery.conventions') }}</OsTypography>
          <OsTypography type="paragraph" ellipsis :rows="2" expandable>
            {{ t('gallery.typographySample') }}
          </OsTypography>
          <OsTypography type="link" href="https://vuejs.org">Vue</OsTypography>
          <OsSpace size="md" wrap>
            <OsTypography strong>{{ t('gallery.cardTitle') }}</OsTypography>
            <OsTypography status="error">{{ t('gallery.typoError') }}</OsTypography>
            <OsTypography status="warning">{{ t('gallery.typoWarning') }}</OsTypography>
            <OsTypography disabled>{{ t('gallery.disabled') }}</OsTypography>
          </OsSpace>
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsTag</h3>
        <OsSpace size="xs" wrap>
          <OsTag>{{ t('gallery.tagAlpha') }}</OsTag>
          <OsTag status="info">{{ t('gallery.tagBeta') }}</OsTag>
          <OsTag status="success">{{ t('gallery.tagBeta') }}</OsTag>
          <OsTag status="warning">{{ t('gallery.tagGamma') }}</OsTag>
          <OsTag status="error">{{ t('gallery.tagGamma') }}</OsTag>
          <OsTag v-if="tagClosable" status="info" closable @close="tagClosable = false">
            {{ t('gallery.tagAlpha') }}
          </OsTag>
        </OsSpace>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsAvatar</h3>
        <OsSpace size="sm" align="center">
          <OsAvatar size="sm" text="S" />
          <OsAvatar size="md" text="M" />
          <OsAvatar size="lg" text="L" />
          <OsAvatar icon="settings" />
          <OsAvatar src="/broken-url-demo.png" alt="" />
        </OsSpace>
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsDescriptions</h3>
        <OsDescriptions :items="descItems" :title="t('gallery.descTitle')" :column="2" />
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsSegmented</h3>
        <OsSegmented v-model="segVal" :options="segOptions" :label="t('gallery.segLabel')" />
      </section>
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsTree</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.treeHint') }}</p>
        <div class="flex flex-wrap gap-lg">
          <div class="w-64">
            <OsTree
              v-model:checked-keys="treeChecked"
              v-model:expanded-keys="treeExpanded"
              :data="treeData"
              checkable
            />
            <p class="mt-2xs text-caption text-ink-mute">
              {{ t('gallery.treeCheckedCount', { n: treeChecked.length }) }}
            </p>
          </div>
          <div class="w-64">
            <OsTree
              v-model:expanded-keys="lazyExpanded"
              v-model:selected-keys="lazySelected"
              :data="lazyTreeData"
              :load-data="loadTreeChildren"
            />
          </div>
        </div>
      </section>
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

    <!-- 导航 -->
    <div v-else-if="tab === 'nav'" class="space-y-5 p-4">
      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsDropdown</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.dropdownHint') }}</p>
        <OsSpace size="lg" align="center" wrap>
          <OsDropdown :items="dropdownItems" @click="onNavDropdownClick">
            <OsButton variant="primary">{{ t('gallery.dropdownTrigger') }}</OsButton>
          </OsDropdown>
          <OsDropdown
            :items="dropdownItems"
            trigger="hover"
            placement="right-start"
            @click="onNavDropdownClick"
          >
            <OsButton>{{ t('gallery.dropdownHoverTrigger') }}</OsButton>
          </OsDropdown>
          <span v-if="dropdownEcho" class="text-caption text-ink-mute">
            {{ t('gallery.dropdownClicked', { v: dropdownEcho }) }}
          </span>
        </OsSpace>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsMenu</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.menuHint') }}</p>
        <div class="flex flex-wrap gap-lg">
          <div class="w-64">
            <h4 class="mb-2xs text-caption text-ink-mute">{{ t('gallery.menuVertical') }}</h4>
            <OsMenu v-model:selected-keys="navMenuSelected" :items="verticalMenu" />
          </div>
          <div class="min-w-0">
            <h4 class="mb-2xs text-caption text-ink-mute">{{ t('gallery.menuHorizontal') }}</h4>
            <div class="rounded-surface border border-line bg-surface p-2xs">
              <OsMenu :items="horizontalMenu" mode="horizontal" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsBreadcrumb</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.breadcrumbHint') }}</p>
        <OsBreadcrumb :items="breadcrumbItems" :max-visible-items="3" @click="onBreadcrumbClick" />
        <p class="mt-2xs text-caption text-ink-mute">
          {{ t('gallery.currentValue', { v: breadcrumbEcho || t('gallery.bcFile') }) }}
        </p>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsSteps</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.stepsHint') }}</p>
        <OsSteps v-model:current="stepCurrent" :items="stepItems" :error="stepError" />
        <OsSpace size="xs" align="center" wrap class="mt-sm">
          <OsButton size="sm" :disabled="stepCurrent === 0" @click="stepPrev">
            {{ t('gallery.stepPrev') }}
          </OsButton>
          <OsButton size="sm" :disabled="stepCurrent === stepItems.length - 1" @click="stepNext">
            {{ t('gallery.stepNext') }}
          </OsButton>
          <OsSwitch v-model="stepError" :label="t('gallery.stepErrorToggle')" />
        </OsSpace>
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

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsAlert</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.alertHint') }}</p>
        <div class="flex flex-col gap-sm">
          <OsAlert type="info" :message="t('gallery.alertInfo')" />
          <OsAlert type="success" :message="t('gallery.alertSuccess')" />
          <OsAlert type="warning" :message="t('gallery.alertWarning')" />
          <OsAlert
            v-if="alertVisible"
            type="error"
            banner
            closable
            :message="t('gallery.alertError')"
            :description="t('gallery.alertDesc')"
            @close="alertVisible = false"
          >
            <template #action>
              <OsButton
                size="sm"
                @click="notif.push(t('gallery.alertError'), t('gallery.alertDesc'))"
              >
                {{ t('gallery.alertAction') }}
              </OsButton>
            </template>
          </OsAlert>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsSpin</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.spinHint') }}</p>
        <div class="flex flex-wrap items-start gap-lg">
          <OsSpace size="lg" align="center">
            <OsSpin size="sm" />
            <OsSpin size="md" />
            <OsSpin size="lg" :tip="t('gallery.spinTip')" />
          </OsSpace>
          <div class="w-64">
            <OsSpin :loading="spinOverlay" :tip="t('gallery.spinTip')">
              <div class="rounded-surface border border-line bg-surface p-md text-ui text-ink">
                {{ t('gallery.cardBody') }}
              </div>
            </OsSpin>
          </div>
          <OsSwitch v-model="spinOverlay" :label="t('gallery.spinOverlay')" />
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsProgress</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.progressHint') }}</p>
        <OsSpace size="lg" align="center" wrap>
          <div class="w-48">
            <OsProgress :percent="progressPct" :status="progressStatus" />
          </div>
          <OsProgress type="circle" :percent="progressPct" :status="progressStatus" />
          <OsButton size="sm" @click="bumpProgress">{{ t('gallery.progressAdd') }}</OsButton>
          <OsButton size="sm" variant="danger" @click="progressStatus = 'exception'">
            {{ t('gallery.progressException') }}
          </OsButton>
        </OsSpace>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsResult</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.resultHint') }}</p>
        <OsSegmented
          v-model="resultStatus"
          :options="resultStatusOptions"
          :label="t('gallery.resultDemo')"
        />
        <OsResult class="mt-sm" :status="resultStatus as ResultStatus">
          <template v-if="resultStatus === 'error'" #default>
            <p>{{ t('gallery.resultDetail') }}</p>
          </template>
          <template #extra>
            <OsSpace size="xs">
              <OsButton size="sm" @click="win.open('settings')">
                {{ t('gallery.resultGoSettings') }}
              </OsButton>
              <OsButton size="sm" variant="primary" @click="resultStatus = 'success'">
                {{ t('common.retry') }}
              </OsButton>
            </OsSpace>
          </template>
        </OsResult>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">OsPopconfirm</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.popconfirmHint') }}</p>
        <OsPopconfirm
          :title="t('gallery.popconfirmTitle')"
          :description="t('gallery.popconfirmDesc')"
          @confirm="notif.push(t('gallery.popconfirmDone'))"
        >
          <OsButton size="sm" variant="danger">{{ t('gallery.popconfirmTrigger') }}</OsButton>
        </OsPopconfirm>
      </section>

      <section>
        <h3 class="mb-2 text-title font-strong text-ink">useFeedback</h3>
        <p class="mb-xs text-caption text-ink-mute">{{ t('gallery.feedbackApiHint') }}</p>
        <OsSpace size="xs" wrap>
          <OsButton size="sm" @click="feedback.success(t('gallery.feedbackApiSaved'))">
            success
          </OsButton>
          <OsButton size="sm" @click="feedback.error(t('gallery.feedbackApiFailed'))">
            error
          </OsButton>
          <OsButton size="sm" @click="feedback.warning(t('gallery.feedbackApiWarned'))">
            warning
          </OsButton>
          <OsButton size="sm" @click="feedback.info(t('gallery.feedbackApiInfoed'))">info</OsButton>
          <OsButton size="sm" variant="primary" @click="askFeedback">
            {{ t('gallery.feedbackApiConfirm') }}
          </OsButton>
        </OsSpace>
      </section>
    </div>
  </OsTabs>
</template>
